# TDD Log — student-photo-records

- 測試指令：`pnpm test`（單檔 Red 時用 `pnpm vitest run <file>`，同一套 vitest 設定）
- Seam（使用者已確認）：
  1. `src/store/photos.ts`（照片 repository）＋ `src/store/db.ts` DB v1→v2 升級；IndexedDB 以 `fake-indexeddb` 提供，空間不足以 spy `IDBObjectStore.prototype.put` 拋 `QuotaExceededError` 模擬
  2. `src/domain/photoImage.ts` `preparePhoto(file, codec)`，codec 為瀏覽器邊界，測試用假 codec
  3. `src/store/photoBackup.ts`（fflate zip 匯出／匯入、`shareFile()`、kv `photoBackupAt`）；分享面板以 stub `navigator.share/canShare` 模擬
  4. 元件測試 `src/screens/StudentPhotos.test.tsx`（jsdom + Testing Library）
- Schema slice：有（IndexedDB `bloomin` v1 → v2，新增 `photos` store）
- 輸出只節錄相關行；「全套」指 `pnpm test` 的摘要。

## Slice 0 — schema / migration（Scenario：資料庫升級保留既有資料（State））
### Red
測試：`src/store/db.test.ts::IndexedDB 結構 > 資料庫升級保留既有資料（State）`
```
 ❯ |node| src/store/db.test.ts (1 test | 1 failed) 9ms
   × IndexedDB 結構 > 資料庫升級保留既有資料（State） 8ms
     → (0 , getDb) is not a function
```
失敗類型：符號不存在（`getDb` 未匯出；DB 仍為 v1、沒有 `photos` store）。`loadState()` 讀回 v1 的 state 那段已通過。
### Green
變更：`src/store/db.ts` — `DB_VERSION` 1→2；`upgrade(db, oldVersion)` 依版本增量建立（<1 建 kv、<2 建 `photos` keyPath `id` + index `studentId`）；匯出 `getDb`、`PHOTOS_STORE`。
```
 ✓ |node| src/store/db.test.ts (1 test) 22ms
 Test Files  6 passed (6)
      Tests  62 passed (62)
```

## Slice 1 — 新增一張照片（Happy Path）
### Red
測試：`src/store/photos.test.ts::新增照片 > 新增一張照片（Happy Path）`（假 codec：`src/test/fakeCodec.ts`）
```
 FAIL  |node| src/store/photos.test.ts [ src/store/photos.test.ts ]
Error: Cannot find module './photos' imported from '.../src/store/photos.test.ts'
```
失敗類型：符號不存在（`photos.ts` 尚未建立）
### Green
變更：新增 `src/domain/photoImage.ts`（`ImageCodec` 介面、`preparePhoto`：原圖長邊 2000／0.85、縮圖長邊 400／0.7）、`src/store/photos.ts`（`Photo`、`listAllPhotos`、`addPhotoFiles`）
```
 ✓ |node| src/store/photos.test.ts (1 test) 12ms
 Test Files  7 passed (7)
      Tests  63 passed (63)
```

## Slice 2 — 一次新增多張照片（Happy Path）
### Red
測試：`src/store/photos.test.ts::新增照片 > 一次新增多張照片（Happy Path）`
第一次執行即通過 → **既有行為，無 Green**：Slice 1 的 `addPhotoFiles` 本來就逐一處理 `files` 並共用 `meta`。
為確認測試有效，做突變檢查（暫時把迴圈改成只處理第一張，跑完即還原）：
```
   × 新增照片 > 一次新增多張照片（Happy Path） 7ms
     → expected [ { …(9) } ] to have a length of 3 but got 1
```
還原後全套：
```
 Test Files  7 passed (7)
      Tests  64 passed (64)
```

## Slice 3 — 小於上限的照片不放大（Edge Case）
### Red
測試：`src/store/photos.test.ts::新增照片 > 小於上限的照片不放大（Edge Case）`
```
   × 新增照片 > 小於上限的照片不放大（Edge Case） 4ms
     → expected 2000 to be 1200 // Object.is equality
```
失敗類型：斷言失敗（Slice 1 的最少實作一律縮放到長邊 2000，小圖被放大）
### Green
變更：`src/domain/photoImage.ts` `fit()` 的比例取 `Math.min(1, …)`
```
 Test Files  7 passed (7)
      Tests  65 passed (65)
```

## Slice 4 — 直式照片的方向與相簿一致（Edge Case）
### Red
測試：`src/store/photos.test.ts::新增照片 > 直式照片的方向與相簿一致（Edge Case）`
第一次執行即通過 → **既有行為，無 Green**。`preparePhoto` 一律以 `codec.decode()` 回報的寬高計算，而 codec 契約是回傳「已套用 EXIF 方向」的寬高（真實實作靠 `createImageBitmap(..., { imageOrientation: 'from-image' })`）。
判斷：測試有效但保護範圍有限 —— 它確保輸出尺寸跟隨解碼後的方向（1500x2000 而非 2000x1500），無法驗證真實瀏覽器是否正確套用 EXIF；該部分列為 iPhone 實機驗證項目。
```
 ✓ |node| src/store/photos.test.ts (4 tests) 8ms
```

## Slice 5 — 超大原圖仍能縮成上限尺寸（Integration）
### Red
測試：`src/store/photos.test.ts::新增照片 > 超大原圖仍能縮成上限尺寸（Integration）`
第一次執行即通過 → **既有行為，無 Green**：與 Slice 1 同一條縮放規則（長邊 → 2000）。
判斷：測試有效（Slice 3 之前的突變——不縮放——就會讓它失敗），但 Scenario 的「Integration」重點是 iOS canvas 像素上限；真實 codec 以 `createImageBitmap` 的 `resizeWidth/resizeHeight` 直接解碼成目標尺寸、canvas 只開 ≤2000px，這一段無單元測試，列為實機驗證項目。
```
 ✓ |node| src/store/photos.test.ts (5 tests) 8ms
```

## Slice 6 — 接受任意合法的紀錄日期（Edge Case）
### Red
測試：`src/store/photos.test.ts::新增照片 > 接受任意合法的紀錄日期（Edge Case）`
第一次執行即通過 → **既有行為，無 Green**：`addPhotoFiles` 原樣保存 `recordDate`，沒有任何範圍限制。
判斷：測試有效——若日後有人加上「只能選近期日期」之類的限制，它會失敗。規格提到「只驗證格式」，但沒有任何 Scenario 要求拒絕格式錯誤的日期；畫面使用 `<input type="date">` 保證格式，故未在資料層另加格式檢查（回報中列出）。
```
 ✓ |node| src/store/photos.test.ts (6 tests) 9ms
```

## Slice 7 — 已封存學生的紀錄本照常可用（Edge Case）
### Red
測試：`src/store/photos.test.ts::新增照片 > 已封存學生的紀錄本照常可用（Edge Case）`
第一次執行即通過 → **既有行為，無 Green**：照片層只以 `studentId` 存取，完全不讀 `Student.archived`（依設計，資料需求「不看 Student.archived」）。
判斷：資料層沒有能讓它失敗的分支，保護力弱；畫面層 `StudentPhotos` 以 `students.find` 找學生、不過濾 archived（沿用 StudentDetail 的做法）。
```
 ✓ |node| src/store/photos.test.ts (7 tests) 9ms
```

## Slice 8 — 無法解碼的檔案被略過（Error Handling）
### Red
測試：`src/store/photos.test.ts::無法處理的輸入 > 無法解碼的檔案被略過（Error Handling）`
```
   × 無法處理的輸入 > 無法解碼的檔案被略過（Error Handling） 3ms
     → 無法解碼
```
失敗類型：功能未實作（解碼錯誤直接拋出，整批中斷，第二張也沒存）
### Green
變更：`src/store/photos.ts` — 逐張 `try { preparePhoto }`，失敗計入 `unreadable` 後繼續；`AddPhotosResult` 加 `unreadable`
```
 Test Files  7 passed (7)
      Tests  70 passed (70)
```

## Slice 9 — 儲存空間不足時該張不寫入（Error Handling）
### Red
測試：`src/store/photos.test.ts::無法處理的輸入 > 儲存空間不足時該張不寫入（Error Handling）`（spy `IDBObjectStore.prototype.put` 拋 `DOMException('…', 'QuotaExceededError')`）
```
   × 無法處理的輸入 > 儲存空間不足時該張不寫入（Error Handling） 4ms
     → The quota has been exceeded.
```
失敗類型：功能未實作（例外直接拋出，沒有回報；`describeAddResult` 也不存在）
### Green
變更：`src/store/photos.ts` — `put` 失敗且為 `QuotaExceededError` 時停止並把剩餘張數計入 `noSpace`，其他錯誤照拋；新增 `describeAddResult`、`isQuotaError`
```
 Test Files  7 passed (7)
      Tests  71 passed (71)
```

## Slice 10 — 編輯照片的日期與說明（Happy Path）
### Red
測試：`src/store/photos.test.ts::編輯照片 > 編輯照片的日期與說明（Happy Path）`
```
   × 編輯照片 > 編輯照片的日期與說明（Happy Path） 2ms
     → (0 , updatePhoto) is not a function
```
失敗類型：符號不存在
### Green
變更：`src/store/photos.ts` — `getPhoto`、`updatePhoto`（同一個 readwrite 交易內讀改寫，只換 recordDate/caption）
```
 Test Files  7 passed (7)
      Tests  72 passed (72)
```

## Slice 11 — 照片依紀錄日期由新到舊並依月分組（Edge Case）
### Red
測試：`src/store/photos.test.ts::紀錄本列表 > 照片依紀錄日期由新到舊並依月分組（Edge Case）`（Given 以 `src/test/photoFixtures.ts` 直接寫入 store）
```
   × 紀錄本列表 > 照片依紀錄日期由新到舊並依月分組（Edge Case） 3ms
     → (0 , listPhotosByMonth) is not a function
```
失敗類型：符號不存在
### Green
變更：`src/store/photos.ts` — `PhotoSummary`（= Photo 去掉 blob）、`listPhotosByMonth`（studentId index 查詢 → recordDate desc、createdAt desc → 依 `monthKey` 分組）
```
 Test Files  7 passed (7)
      Tests  73 passed (73)
```
備註：「列表只讀取 thumb，不讀取 blob」在此以「列表 API 不交出 blob」驗證。IndexedDB 無法只取部分欄位，`getAll` 仍會取回整筆記錄（瀏覽器對記錄中的 Blob 是延遲讀取的檔案參照，不會解碼像素）；畫面層只用 thumb 建 object URL。

## Slice 12 — 還原資料備份不影響照片（Edge Case）
### Red
測試：`src/store/photos.test.ts::與資料備份互不影響 > 還原資料備份不影響照片（Edge Case）`（呼叫真正的 `useStore.importState` / `rollbackImport`）
第一次執行即通過 → **既有行為，無 Green**：兩者只寫 kv 的 `state` / `rollback`，照片在獨立 store。
突變檢查（暫時讓 `importState` 清空 photos store，跑完即還原）：
```
   × 與資料備份互不影響 > 還原資料備份不影響照片（Edge Case） 3ms
     → expected undefined to be defined
```
還原後全套：
```
 Test Files  7 passed (7)
      Tests  74 passed (74)
```

## Slice 13 — 匯出照片備份（Happy Path）
### Red
測試：`src/store/photoBackup.test.ts::匯出照片備份 > 匯出照片備份（Happy Path）`（stub `navigator.canShare/share` 攔下送進分享面板的檔案，用 fflate `unzipSync` 解開檢查）
```
Error: Cannot find module './photoBackup' imported from '.../src/store/photoBackup.test.ts'
```
失敗類型：符號不存在
### Green
變更：新增 `src/store/photoBackup.ts`（`PhotoManifest`、`exportPhotoBackup`：`zipSync(level 0)` → `shareFile` → 記錄時間）；`src/store/db.ts` 加 `loadPhotoBackupAt` / `savePhotoBackupAt`（kv `photoBackupAt`）
```
 Test Files  8 passed (8)
      Tests  75 passed (75)
```

## Slice 14 — 照片備份透過分享面板送出（Integration）
### Red
測試：`src/store/photoBackup.test.ts::匯出照片備份 > 照片備份透過分享面板送出（Integration）`
```
   × 匯出照片備份 > 照片備份透過分享面板送出（Integration） 4ms
     → expected false to be true // Object.is equality
```
失敗類型：斷言失敗（檔名仍是暫定的 `bloomin-photos.zip`）
### Green
變更：`src/store/photoBackup.ts` — `photoBackupFileName(now)` → `bloomin-照片備份-YYYYMMDD-HHmm.zip`
```
 Test Files  8 passed (8)
      Tests  76 passed (76)
```

## Slice 15 — 取消分享時不算備份完成（Error Handling）
### Red
測試：`src/store/photoBackup.test.ts::匯出照片備份 > 取消分享時不算備份完成（Error Handling）`（`navigator.share` 拋 `AbortError`，走真正的 `shareFile` → `'cancelled'`）
```
   × 匯出照片備份 > 取消分享時不算備份完成（Error Handling） 4ms
     → expected '2026-09-29T06:05:00.000Z' to be '2026-09-01T00:00:00Z' // Object.is equality
```
失敗類型：斷言失敗（取消仍更新了 photoBackupAt）
### Green
變更：`src/store/photoBackup.ts` — 只有 outcome 非 `cancelled` 才 `savePhotoBackupAt`；新增 `describeExport`
```
 Test Files  8 passed (8)
      Tests  77 passed (77)
```

## Slice 16 — 匯入照片備份（Happy Path）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 匯入照片備份（Happy Path）`（Given 的 zip 由測試以 fflate 依格式手工組成，不經匯出程式）
```
   × 匯入照片備份 > 匯入照片備份（Happy Path） 3ms
     → (0 , importPhotoBackup) is not a function
```
失敗類型：符號不存在
### Green
變更：`src/store/photoBackup.ts` — `importPhotoBackup`（unzip → manifest → 逐筆 put）、`describeImport`；manifest 加 `thumbFile`（`thumbs/<id>.jpg`），匯出同步寫入縮圖（`thumbFile` 為必填型別欄位，匯出端必須跟著產出）
```
 Test Files  8 passed (8)
      Tests  78 passed (78)
```

## Slice 17 — 已存在的照片在匯入時略過（Edge Case）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 已存在的照片在匯入時略過（Edge Case）`
```
   × 匯入照片備份 > 已存在的照片在匯入時略過（Edge Case） 4ms
     → expected '備份版本' to be '本機版本' // Object.is equality
```
失敗類型：斷言失敗（備份版本覆蓋了本機版本）
### Green
變更：`src/store/photoBackup.ts` — 寫入前 `getKey` 檢查，已存在計入 `skippedExisting`；`describeImport` 附「略過 N 張已存在」
```
 Test Files  8 passed (8)
      Tests  79 passed (79)
```

## Slice 18 — 找不到所屬學生的照片仍會匯入（Edge Case）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 找不到所屬學生的照片仍會匯入（Edge Case）`
```
   × 匯入照片備份 > 找不到所屬學生的照片仍會匯入（Edge Case） 6ms
     → expected { ok: true, added: 1, …(1) } to match object { ok: true, added: 1, orphaned: 1 }
```
失敗類型：斷言失敗（照片有存入，但沒有回報孤立張數）
### Green
變更：`src/store/photoBackup.ts` — 以呼叫端傳入的 `knownStudentIds` 計算 `orphaned`，照片照樣寫入；`describeImport` 附「其中 K 張屬於目前找不到的學生，還原對應的資料備份後就會出現。」
```
 Test Files  8 passed (8)
      Tests  80 passed (80)
```

## Slice 19 — 無效的照片備份被整份拒絕（Error Handling）（Scenario Outline，4 個 Examples）
### Red
測試：`src/store/photoBackup.test.ts::無效的照片備份 > 無效的照片備份被整份拒絕（Error Handling）：<問題>`（`it.each`，每列一個 Example；後兩例的 zip 內含 p2，確保「沒擋下就會被寫入」）
```
   × 無效的照片備份被整份拒絕（Error Handling）：不是 zip 3ms
     → invalid zip data
   × 無效的照片備份被整份拒絕（Error Handling）：缺少 manifest.json 0ms
     → Unexpected end of JSON input
   × 無效的照片備份被整份拒絕（Error Handling）：manifest 的 app 不是 bloomin-photos 2ms
     → expected true to be false // Object.is equality
   × 無效的照片備份被整份拒絕（Error Handling）：manifest 的 schemaVersion 比 App 新 1ms
     → expected true to be false // Object.is equality
```
失敗類型：功能未實作（前兩例例外直接拋出、沒有拒絕結果；後兩例被照單全收）
### Green
變更：`src/store/photoBackup.ts` — `parsePhotoBackup`：寫入前依序檢查 zip 可解、manifest 存在且為 JSON、`app`、`schemaVersion`（≤ 目前版本）、`photos` 為陣列；任一不符回傳 `{ ok: false, error }`
```
 Test Files  8 passed (8)
      Tests  84 passed (84)
```

## Slice 20 — 缺少圖檔的項目被略過（Error Handling）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 缺少圖檔的項目被略過（Error Handling）`
```
   × 匯入照片備份 > 缺少圖檔的項目被略過（Error Handling） 4ms
     → expected { id: 'p2', studentId: 's1', …(7) } to be undefined
```
失敗類型：斷言失敗（缺圖檔的 p2 仍被寫入，blob 是內容為 "undefined" 的殘缺 Blob）
### Green
變更：`src/store/photoBackup.ts` — 原圖或縮圖任一缺失即略過並計入 `missingFile`；`describeImport` 附「略過 N 張檔案缺失」
```
 Test Files  8 passed (8)
      Tests  85 passed (85)
```

## Slice 21 — 匯入途中空間不足時保留已匯入的部分（Error Handling）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 匯入途中空間不足時保留已匯入的部分（Error Handling）`（spy `put`：第 1 次放行，之後拋 `QuotaExceededError`）
```
   × 匯入照片備份 > 匯入途中空間不足時保留已匯入的部分（Error Handling） 5ms
     → The quota has been exceeded.
```
失敗類型：功能未實作（例外直接拋出，沒有部分結果回報）
### Green
變更：`src/store/photoBackup.ts` — `put` 遇 `QuotaExceededError` 即中止，`noSpace` = 尚未處理的項目數；`describeImport` 回報「裝置儲存空間不足，已匯入 N 張、M 張因空間不足未匯入…」
```
 Test Files  8 passed (8)
      Tests  86 passed (86)
```

## Slice 22 — 刪除後可從備份找回（State）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 刪除後可從備份找回（State）`
```
   × 匯入照片備份 > 刪除後可從備份找回（State） 3ms
     → (0 , deletePhoto) is not a function
```
失敗類型：符號不存在（刪除尚未實作）
### Green
變更：`src/store/photos.ts` — `deletePhoto`（實體刪除）。匯入端不需改動：id 已不存在就視為新增。
```
 Test Files  8 passed (8)
      Tests  87 passed (87)
```

## Slice 23 — 匯出的備份可被匯入還原（Integration）
### Red
測試：`src/store/photoBackup.test.ts::匯入照片備份 > 匯出的備份可被匯入還原（Integration）`（真正的匯出 → 清空 → 匯入同一份檔案，逐欄比對含 blob/thumb 位元組）
第一次執行即通過 → **既有行為，無 Green**：Slice 16 為了滿足 `thumbFile` 型別，匯出端已同時寫入縮圖。
突變檢查（暫時讓匯出不寫縮圖，跑完即還原）：
```
   × 匯入照片備份 > 匯出的備份可被匯入還原（Integration） 15ms
     → expected [] to deeply equal [ { studentId: 's1', …(8) }, …(1) ]
```
還原後全套：
```
 Test Files  8 passed (8)
      Tests  88 passed (88)
```

## Slice 24 — 沒有照片時顯示空狀態（Edge Case）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 沒有照片時顯示空狀態（Edge Case）`（jsdom project；學生以 `useStore.setState` 放入 Given）
```
Error: Failed to resolve import "./StudentPhotos" from "src/screens/StudentPhotos.test.tsx". Does the file exist?
```
失敗類型：符號不存在
### Green
變更：新增 `src/screens/StudentPhotos.tsx`（返回列、標題、隱藏的 `<input type="file" accept="image/*" multiple>`、載入完成且無照片時的 EmptyState + 「新增照片」按鈕）與 `StudentPhotos.module.css`
```
 Test Files  9 passed (9)
      Tests  89 passed (89)
```

## Slice 25 — 學生不存在時顯示找不到（Error Handling）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 學生不存在時顯示找不到（Error Handling）`
```
   × 照片紀錄本畫面 > 學生不存在時顯示找不到（Error Handling） 1011ms
     → Unable to find an element with the text: 找不到這位學生. …
```
失敗類型：斷言失敗（找不到學生時元件回傳 null）
### Green
變更：`src/screens/StudentPhotos.tsx` — 沿用 StudentDetail 的「找不到這位學生」EmptyState 與「回到學生列表」
```
 Test Files  9 passed (9)
      Tests  90 passed (90)
```

## Slice 26 — 檢視照片原尺寸（Happy Path）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 檢視照片原尺寸（Happy Path）`（`URL.createObjectURL` 以 stub 記下 URL→Blob，檢查檢視器 `<img>` 指向的 Blob 內容）
```
   × 照片紀錄本畫面 > 檢視照片原尺寸（Happy Path） 1008ms
     → Unable to find role="button" and name `/開啟.*照片/`
```
失敗類型：功能未實作（沒有縮圖格也沒有檢視器）
### Green
變更：`src/screens/StudentPhotos.tsx` — 依月分組縮圖格（`Thumb` 只用 thumb 建 object URL）、`Viewer`（`getPhoto` 取原圖、顯示 `formatDateLong` 日期與說明）、`useObjectUrl`（卸載時 revoke）；CSS 補縮圖格與檢視器樣式
```
 Test Files  9 passed (9)
      Tests  91 passed (91)
```

## Slice 27 — 儲存處理中不會重複寫入（Edge Case）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 儲存處理中不會重複寫入（Edge Case）`（`vi.mock('../lib/imageCodec')` 換成假 codec，decode 被 gate 卡住模擬處理中；連按兩次「儲存」後放行）
初版以 `findByRole('dialog', { name: '新增照片' })` 找 Sheet，但共用 Sheet 沒有可及性名稱 —— 屬測試自身問題，改成直接找「儲存」按鈕後重跑（未修改 Sheet）：
```
   × 照片紀錄本畫面 > 儲存處理中不會重複寫入（Edge Case） 1012ms
     → Unable to find role="button" and name "儲存"
```
失敗類型：功能未實作（沒有新增流程）
### Green
變更：`src/screens/StudentPhotos.tsx` — 選檔（`onChange` 清 value）→ Sheet（紀錄日期預設今天；單張才有說明欄）→ `save()`：`saving` 時直接返回、按鈕 disabled 並顯示「處理中…」，完成後顯示 `describeAddResult` 並重載列表；新增 `src/lib/imageCodec.ts`（真正的瀏覽器 codec，無單元測試）
```
 Test Files  9 passed (9)
      Tests  92 passed (92)
```
突變檢查（拿掉 `saving` 判斷與 disabled，跑完即還原），證明測試抓得到重複寫入：
```
   × 照片紀錄本畫面 > 儲存處理中不會重複寫入（Edge Case） 1035ms
     → expected [ { …(9) }, { …(9) } ] to have a length of 1 but got 2
```
還原後全套：`Tests 92 passed (92)`

## Slice 28 — 顯示儲存空間用量（Integration）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 顯示儲存空間用量（Integration）`（stub `navigator.storage.estimate`）
```
   × 照片紀錄本畫面 > 顯示儲存空間用量（Integration） 1012ms
     → Unable to find an element with the text: /已使用/. …
```
失敗類型：功能未實作
### Green
變更：`src/screens/StudentPhotos.tsx` — 列表變動後呼叫 `storageEstimate()`，有值時顯示「已使用 N MB，可用配額 M MB」
```
 Test Files  9 passed (9)
      Tests  93 passed (93)
```

## Slice 29 — 無法取得儲存空間時不顯示用量（Integration）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 無法取得儲存空間時不顯示用量（Integration）`（`estimate()` 拋 `SecurityError`；以 `process.on('unhandledRejection')` 收集未處理的錯誤）
```
   × 照片紀錄本畫面 > 無法取得儲存空間時不顯示用量（Integration） 35ms
     → expected [ …(2) ] to deeply equal []
```
失敗類型：斷言失敗（估計失敗變成 2 個未處理的 rejection —— 載入前後各估一次）
### Green
變更：`src/screens/StudentPhotos.tsx` — `storageEstimate()` 失敗時 `setUsage(null)`，不顯示也不報錯（未改動共用的 `storageEstimate`，避免影響 OfflineStatus）
```
 Test Files  9 passed (9)
      Tests  94 passed (94)
```

## Slice 30 — 確認後刪除照片（State）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 確認後刪除照片（State）`
```
   × 照片紀錄本畫面 > 確認後刪除照片（State） 26ms
     → Unable to find an accessible element with the role "button" and name "刪除"
```
失敗類型：功能未實作
### Green
變更：`src/screens/StudentPhotos.tsx` — 檢視器加「刪除」→ 確認 Sheet（「刪除後無法復原，除非有照片備份。」、取消／刪除照片）→ `deletePhoto` 後關閉檢視器並重載列表
```
 Test Files  9 passed (9)
      Tests  95 passed (95)
```

## Slice 31 — 取消刪除時照片保留（State）
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 取消刪除時照片保留（State）`
第一次執行即通過 → **既有行為，無 Green**：Slice 30 的確認 Sheet 的「取消」只關閉 Sheet。
突變檢查（讓「刪除」不經確認就直接刪，跑完即還原）：
```
   × 照片紀錄本畫面 > 取消刪除時照片保留（State） 44ms
     → expected undefined to be defined
```
還原後全套：
```
 Test Files  9 passed (9)
      Tests  96 passed (96)
```

## Slice 32 — 照片只存在本機且不需登入（Permission）
## Slice 33 — 離線時照片功能完整可用（Integration）
### Red
測試：`src/store/photosOffline.test.ts::本機與離線 > 照片只存在本機且不需登入（Permission）`、`… > 離線時照片功能完整可用（Integration）`
做法：`fetch`、`XMLHttpRequest`（open/send）、`navigator.sendBeacon` 全換成「記下呼叫並拋 `TypeError('Network request failed…')`」，等同沒有網路；分享面板以本機 stub 取代。Permission 跑「無任何登入設定 → 新增 → 匯出」；Integration 跑「新增 2 張 → 列表 → 檢視原圖 → 編輯 → 刪除 → 匯出（記錄 photoBackupAt）→ 清空 → 匯入」。兩者都斷言流程成功且 `networkCalls` 為空陣列。
第一次執行即通過 → **既有行為，無 Green**：照片功能全程只用 IndexedDB 與本機分享面板。
突變檢查（暫時讓匯出多 `fetch` 上傳、匯入多 `sendBeacon`，跑完即還原）：
```
   × 本機與離線 > 照片只存在本機且不需登入（Permission） 9ms
     → Network request failed: device is offline
   × 本機與離線 > 離線時照片功能完整可用（Integration） 11ms
     → Network request failed: device is offline
```
還原後全套：
```
 Test Files  10 passed (10)
      Tests  98 passed (98)
```
限制：Service Worker 離線快取（App 殼層能否離線開啟）不在此測試範圍，沿用既有 PWA 設定；真實 codec 在此以假 codec 取代。

## 畫面接線（無對應 Scenario，未新增測試）
規格的 UI 要求中，以下部分沒有對應的 Scenario。依「Scenario 是測試唯一來源」不另寫測試，以 `tsc` + 整套測試 + build 把關，並列入實機驗證清單：
- `src/lib/router.tsx`：新增 `{ name: 'student-photos'; id }` ↔ `/students/<id>/photos`（`parseRoute` / `routePath`）
- `src/App.tsx`、`src/components/AppShell.tsx`：切換畫面；「學生」分頁涵蓋 `student-photos`
- `src/screens/StudentDetail.tsx`：動作按鈕下方「照片紀錄本 · N 張」入口（`countPhotos` 以 index 計數）
- `src/components/PhotoBackupPanel.tsx` + `src/screens/Settings.tsx`：「照片備份」區（上次照片備份時間、匯出、匯入並顯示結果訊息、處理中停用）
- `src/screens/StudentPhotos.tsx`：檢視器的「編輯日期與說明」Sheet；`ZoomableImage` 雙指縮放／雙擊切換；非預期的儲存錯誤顯示訊息
- `src/components/icons/index.tsx`：新增 `IconPhoto`

瀏覽器煙霧測試：以 sharp 產生測試 JPEG（含 EXIF orientation 6 的 4000x3000、8000x6000）準備在 headless Chrome 跑真實 codec，但 Chrome 在此 sandbox 內無法啟動（`Failed to create socket directory`、Crashpad `Operation not permitted`），未執行。

## Refactor（全綠後）
依指示不進行重構，建議列於回報，等使用者決定。

## 最終狀態
```
$ python3 …/ec_gate.py tdd student-photo-records
PASS 解析出 34 個 Scenario 標題
PASS 找到 13 個測試檔案
PASS 所有 Scenario 標題皆在測試檔案中出現
SUMMARY: PASS

$ pnpm test
 Test Files  10 passed (10)
      Tests  98 passed (98)
```

---

# 修正輪（獨立 verifier 回報）

## Fix B1 — manifest 單筆項目未驗證（Scenario Outline：無效的照片備份被整份拒絕（Error Handling））
規格：`coverage.md` Error Handling 新增「manifest 中任何一筆項目結構無效」條目（並註明與「缺少圖檔的項目被略過」的區分）；`.feature` 該 Outline 的 Examples 新增 5 列（欄位缺漏、id 非非空字串、recordDate 非 YYYY-MM-DD、width/height 非正整數、檔案路徑不在 photos/ 或 thumbs/ 之下），Scenario 標題不變。gherkin／coverage 門禁 PASS。
### Red
測試：`src/store/photoBackup.test.ts::無效的照片備份 > 無效的照片備份被整份拒絕（Error Handling）：<問題>（變體）` 共 17 個變體。每份 zip 第 1 筆 p2 合法、第 2 筆 p3 損壞，沒有整份先驗證就會先寫入 p2。另外斷言錯誤訊息指出「第 2 筆」。
```
   × …：manifest 中有欄位缺漏的項目（studentId） 4ms
     → expected true to be false // Object.is equality
   × …：manifest 中有 id 不是非空字串的項目（缺漏） 1ms
     → Data provided to an operation does not meet requirements.
   × …：manifest 中有 id 不是非空字串的項目（null） 1ms
     → Data provided to an operation does not meet requirements.
   × …：manifest 中有 recordDate 不是 YYYY-MM-DD 的項目（斜線） 1ms
     → expected true to be false // Object.is equality
   × …：manifest 中有 width 或 height 不是正整數的項目（字串） 1ms
     → expected true to be false // Object.is equality
   × …：manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（原型鏈屬性） 1ms
     → expected true to be false // Object.is equality
   × …：manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（manifest.json） 1ms
     → expected true to be false // Object.is equality
   （其餘 10 個變體同為 expected true to be false）
      Tests  17 failed | 14 passed (31)
```
失敗類型：功能未實作。id 缺漏／null 時，IndexedDB 在 p2 已寫入後才拋 DataError；其餘變體被當成 ok:true 寫入殘缺資料，`file:'constructor'` 經原型鏈取到 Function 後存成「JPEG」。
### Green
變更：`src/store/photoBackup.ts`
- `parsePhotoBackup` 在寫入前以 `entryProblem` 逐筆驗證：id／studentId 為非空字串、recordDate 符合 `^\d{4}-\d{2}-\d{2}$`、caption／createdAt 為字串、width／height 為正整數、file 以 `photos/` 開頭、thumbFile 以 `thumbs/` 開頭。任一筆不符就整份拒絕，並指出第幾筆。
- zip 內檔案一律用 `zipEntry`（`Object.hasOwn`）查找，包括 manifest.json。
```
 Test Files  10 passed (10)
      Tests  115 passed (115)
```
既有「缺少圖檔的項目被略過（Error Handling）」仍綠：結構合法但 zip 裡沒有該圖檔，仍是略過該張。

## Fix C4 — 讀取照片失敗時顯示錯誤（Error Handling）（新 Scenario）
規格：`coverage.md` Error Handling 新增「開啟紀錄本時讀取照片失敗」條目；`.feature` 新增 Scenario「讀取照片失敗時顯示錯誤（Error Handling）」（@error）。gherkin／coverage 門禁 PASS。
### Red
測試：`src/screens/StudentPhotos.test.tsx::照片紀錄本畫面 > 讀取照片失敗時顯示錯誤（Error Handling）`（spy `IDBIndex.prototype.getAll` 拋 `DOMException('…','UnknownError')`）
```
   × 照片紀錄本畫面 > 讀取照片失敗時顯示錯誤（Error Handling） 1010ms
     → Unable to find an element with the text: /無法讀取照片/. …
⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
```
失敗類型：功能未實作。`reload` 的錯誤變成未處理的 rejection，`groups` 永遠是 null，畫面一片空白。
### Green
變更：`src/screens/StudentPhotos.tsx`。`reload` 會捕捉錯誤並記入 `loadError`，畫面顯示「無法讀取照片」的 EmptyState（附錯誤原因與「重試」）；有錯誤時不顯示「還沒有照片」。
```
 Test Files  10 passed (10)
      Tests  116 passed (116)
```

## Fix B2 — DB 升級被開著的舊連線擋住（新 Scenario ×2）
規格：`coverage.md` State Transitions 新增兩個條目：「升級時還有舊版分頁開著」與「更新版本開啟時本分頁讓出連線」。`.feature` 新增兩個 Scenario：「舊版分頁未關閉時升級不會卡住（State）」與「本分頁不會擋住較新版本的升級（State）」。gherkin／coverage 門禁 PASS。

### B2-1 舊版分頁未關閉時升級不會卡住（State）
#### Red
測試：`src/App.test.tsx::資料庫升級 > 舊版分頁未關閉時升級不會卡住（State）`（jsdom＋fake-indexeddb）。先開一條 v1 連線並寫入 state，保持不關閉，再 render 真正的 `<App />`。
```
   × 資料庫升級 > 舊版分頁未關閉時升級不會卡住（State） 1013ms
     → Unable to find an element with the text: /請關閉其他開著的 BloomIn 分頁/. …
<body>
  <div />
</body>
```
失敗類型：功能未實作。openDB 無限等待，`hydrated` 永遠是 false，App 回傳 null，畫面全白。
#### Green
變更：
- `src/store/db.ts`：`openDB` 加 `blocked()`，透過 `onUpgradeBlocked(listener)` 通知訂閱者。
- `src/store/useStore.ts`：新增 `upgradeBlocked`。hydrate 期間訂閱通知，收到就設為 true，載入完成（或失敗）時歸零並取消訂閱。
- `src/App.tsx`：未載入完成且 `upgradeBlocked` 時顯示 `UpgradeBlocked` 提示（「請關閉其他開著的 BloomIn 分頁或視窗…關閉後這裡會自動繼續」）。

設計判斷：被擋住只是「通知」，不寫入 `hydrateError`。等待本身是正確的，舊連線一關，同一個 openDB promise 就會完成，App 自動進入；也不必重試或重新整理。測試驗證關閉舊連線後出現主導覽、`hydrateError` 為 null、state 與 v1 寫入的完全相同。
```
 Test Files  11 passed (11)
      Tests  117 passed (117)
```

### B2-2 本分頁不會擋住較新版本的升級（State）
#### Red
測試：`src/store/db.test.ts::IndexedDB 結構 > 本分頁不會擋住較新版本的升級（State）`。本模組以 v2 開著時，另開 v3，並以 500ms 計時器競速。
```
   × IndexedDB 結構 > 本分頁不會擋住較新版本的升級（State） 504ms
     → expected 'HUNG' to be 'opened' // Object.is equality
```
失敗類型：功能未實作（沒有處理 versionchange）
#### Green
變更：`src/store/db.ts` 加 `blocking(_, _, event)`，在 versionchange 當下同步 `event.target.close()` 並把 `dbPromise` 設為 null。若非同步關閉（例如經 `dbPromise.then`），對方仍會先收到 blocked，所以測試同時斷言 `blocked === false`。
```
 Test Files  11 passed (11)
      Tests  118 passed (118)
```

## 順手修正 — 瀏覽器 codec（無單元測試，僅 tsc／build 把關，列入實機驗證）
變更：`src/lib/imageCodec.ts`
- `orientedBitmap` 逐級退回：帶 resize＋方向選項（失敗或尺寸不符）→ 只帶 `imageOrientation: 'from-image'` → 不帶任何選項。原本第一次呼叫沒包 try，不支援 resize 選項的瀏覽器會讓整張照片被當成「無法讀取」。
- 畫到 canvas 前先鋪白底，避免透明 PNG 的透明處編成 JPEG 後變黑。
```
 Test Files  11 passed (11)
      Tests  118 passed (118)
```

## 清理
- 移除未使用的 devDep `@testing-library/user-event`（`pnpm remove -D`，lockfile 一併提交）。

## 修正輪最終狀態
```
$ ec_gate.py gherkin student-photo-records  → PASS（37 個 Scenario）
$ ec_gate.py coverage student-photo-records → PASS
$ ec_gate.py tdd student-photo-records      → PASS（所有 Scenario 標題皆在測試檔案中出現）
$ pnpm test
 Test Files  11 passed (11)
      Tests  118 passed (118)
$ pnpm build → ✓ built in 830ms
```

---

# 修正輪 2（verifier 回報 aecb319 引入的潛伏資料遺失）

## Fix — 被較新版本取代後不會靜默遺失輸入（State）（新 Scenario）
規格：`coverage.md` State Transitions 新增「讓出連線當下還有未寫入的變更」條目；`.feature` 新增 Scenario「被較新版本取代後不會靜默遺失輸入（State）」。gherkin／coverage 門禁 PASS。
### Red
測試：`src/App.superseded.test.tsx::資料庫被較新版本取代 > 被較新版本取代後不會靜默遺失輸入（State）`（jsdom＋fake-indexeddb）。流程：真正的 `<App />` hydrate 於 v2 → `updateSettings` 後不 flush，變更仍在 300ms 存檔延遲內 → 另一條連線 `openDB('bloomin', 3)` → 從 v3 讀 kv state、檢查提示畫面 → 再做一次變更並等過存檔延遲，收集 `unhandledRejection`。
```
   × 資料庫被較新版本取代 > 被較新版本取代後不會靜默遺失輸入（State） 121ms
     → expected undefined to be '小花美術教室' // Object.is equality
```
失敗類型：功能未實作。讓出連線時直接 close，存檔延遲內的變更遺失（v3 讀不到任何 state）。
### Green
變更：
- `src/store/db.ts`：新增 `onSuperseded({ unsavedState, superseded })`，只有一個註冊者。`blocking` 先同步呼叫 `unsavedState()`，有值就在 `event.target`（仍開著的原生連線）上建立 readwrite 交易 put 到 kv `state`，然後在 finally 中 `close()`、清 `dbPromise`、呼叫 `superseded()`。close 會等已建立的交易完成，較新版本的升級也會等它寫完；即使 put 拋錯，finally 仍保證讓出連線。
- `src/store/useStore.ts`：新增 `superseded` 狀態。模組層向 db.ts 註冊掛鉤：交出 `pending`，讓出後清掉 timer／pending 並設 `superseded: true`。`flushPersist` 在 superseded 時直接丟棄 pending、不嘗試寫入。
- `src/App.tsx`：superseded 時優先回傳全螢幕 `Superseded`（「BloomIn 已在其他分頁更新，請重新開啟 App」＋「重新載入」→ `location.reload()`），整個 AppShell 不渲染，擋住所有輸入。照指示不自動重新載入。

設計理由：db.ts 直接在 blocking 事件中用原生 API 寫入，store 名稱與 key 只存在 db.ts；useStore 只負責「交出資料」與「接收通知」，不碰 IndexedDB。寫入必須在事件當下同步建立交易，放到 promise 之後連線就已關閉，所以不能沿用非同步的 `saveState`。
```
 Test Files  12 passed (12)
      Tests  119 passed (119)
```
突變檢查（各自跑完即還原），證明後兩個 Then 有效：
- 拿掉 `flushPersist` 的 superseded 防護：
```
     → expected [ Array(1) ] to deeply equal []     （未處理的 rejection 出現）
```
- 拿掉 App 的 `Superseded` 畫面：
```
     → Unable to find an element with the text: /BloomIn 已在其他分頁更新，請重新開啟 App/. …
```
還原後全套：`Test Files 12 passed (12) / Tests 119 passed (119)`；gherkin／coverage／tdd 門禁 PASS；build 成功。

---

# 修正輪 3（使用者要求的四個小問題）

## Fix 3-2 — 匯入接受不存在的日期；`Object.hasOwn` 防線
規格：`coverage.md` 的「manifest 項目結構無效」條目加上「recordDate 不是實際存在的日期（如 2024-13-99、2023-02-29）」；`.feature` 的 Outline 新增 Example 列「manifest 中有 recordDate 不是實際存在日期的項目」。gherkin／coverage 門禁 PASS。
### Red
測試：`src/store/photoBackup.test.ts` 的 Outline 新增兩個變體（`2024-13-99`、`2023-02-29`）
```
   × …：manifest 中有 recordDate 不是實際存在日期的項目（13 月 99 日） 6ms
     → expected true to be false // Object.is equality
   × …：manifest 中有 recordDate 不是實際存在日期的項目（非閏年 2 月 29 日） 1ms
     → expected true to be false // Object.is equality
      Tests  2 failed | 31 passed (33)
```
失敗類型：功能未實作（只驗格式，不驗日期是否存在）
### Green
變更：`src/store/photoBackup.ts` 新增 `isRealDate`，以 `parseISODate` 建立日期後用 `toISODate` 比回原字串（Date 會把溢位日期默默進位）。
```
 Test Files  12 passed (12)
      Tests  121 passed (121)
```
### `Object.hasOwn`：判定多餘並移除（行為不變，無 Red）
- 查證：`Object.getOwnPropertyNames(Object.prototype)` 沒有任何含 `/` 的名稱；fflate `unzipSync` 回傳的是一般物件，原型就是 `Object.prototype`。`entryProblem` 已要求路徑以 `photos/`／`thumbs/` 開頭，所以經原型鏈命中的情況不可能發生；`manifest.json` 又是固定鍵。這道防線到不了任何輸入，所以 verifier 拿掉它測試仍全綠。
- 決定：移除 `zipEntry`，改回直接索引，並在註解說明真正的防線是路徑前綴檢查。
- 證明真正的防線有測試保護（突變：暫時拿掉 `file` 的前綴檢查，跑完即還原）：
```
   × …：manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（原型鏈屬性） 5ms
     → expected true to be false // Object.is equality
   × …：manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（manifest.json） 1ms
     → expected true to be false // Object.is equality
```
還原後全套：`Tests 121 passed (121)`；build 成功。

## Fix 3-3 — 空間不足以交易中止形式回報時被誤判
規格：`coverage.md` Error Handling 新增「瀏覽器以不同形式回報空間不足」條目（判斷依據是交易的 error）；`.feature` 新增兩個 Scenario：「空間不足以交易中止回報時同樣視為空間不足（Error Handling）」「非空間不足的交易中止不會被誤報為空間不足（Error Handling）」。gherkin／coverage 門禁 PASS。
模擬方式：`src/test/storageFull.ts` 的 `simulateTransactionAbort(錯誤名稱, 放行次數)`。它 spy `IDBObjectStore.prototype.put`：先照常送出請求，再呼叫 fake-indexeddb 的 `transaction._abort(錯誤名稱)`，重現瀏覽器中止交易（未完成的請求收到 AbortError、`transaction.error` 為指定錯誤）。只模擬瀏覽器邊界，不碰 App 程式。
### Red
測試：`src/store/photos.test.ts::…空間不足以交易中止回報時同樣視為空間不足（Error Handling）：新增照片`、`src/store/photoBackup.test.ts::…（Error Handling）：匯入`
```
   × 無法處理的輸入 > 空間不足以交易中止回報時同樣視為空間不足（Error Handling）：新增照片 4ms
     → A request was aborted, for example through a call to IDBTransaction.abort.
   × 匯入照片備份 > 空間不足以交易中止回報時同樣視為空間不足（Error Handling）：匯入 4ms
     → A request was aborted, for example through a call to IDBTransaction.abort.
      Tests  2 failed | 46 passed (48)
```
失敗類型：功能未實作。`isQuotaError` 只看請求拋出的錯誤；這裡是 AbortError，於是直接拋出。
「非空間不足的交易中止不會被誤報為空間不足（Error Handling）」第一次就綠：既有行為，原本就會把錯誤原樣拋出。它是用來防止修過頭的護欄，有效性由下方突變檢查證明。
### Green
變更：
- `src/store/photos.ts` 新增 `putPhoto`：保留交易物件，`Promise.all([put, tx.done])` 失敗後等 `tx.done` 結束；`transaction.error` 是空間不足就拋它，否則拋原錯誤。
- `addPhotoFiles` 與 `importPhotoBackup` 都改用 `putPhoto`，原本「遇 QuotaExceededError 停止並計數」的邏輯不變。
```
 Test Files  12 passed (12)
      Tests  124 passed (124)
```
突變檢查（暫時把所有 AbortError 都當成空間不足，跑完即還原）：
```
   × 無法處理的輸入 > 非空間不足的交易中止不會被誤報為空間不足（Error Handling） 6ms
     → promise resolved "{ added: +0, unreadable: +0, …(1) }" instead of rejecting
```
還原後全套：`Tests 124 passed (124)`；build 成功。
備註：Safari 舊版以 name 為 `QuotaExceededError`（code 22）的 DOMException 回報，既有的 name 判斷已涵蓋，未另加 code 判斷。

## Fix 3-1 — Viewer 編輯／刪除失敗靜默；countPhotos 失敗吞錯
規格：`coverage.md` Error Handling 新增兩個條目：「編輯或刪除時寫入失敗」「學生詳情頁計算照片張數失敗」。`.feature` 新增兩個 Scenario：「編輯或刪除失敗時顯示錯誤（Error Handling）」「照片張數取不到時入口不顯示張數（Error Handling）」。gherkin／coverage 門禁 PASS。
### Red
測試：
- `src/screens/StudentPhotos.test.tsx::…編輯或刪除失敗時顯示錯誤（Error Handling）：編輯`（spy `IDBObjectStore.prototype.put` 拋 UnknownError）
- `…：刪除`（spy `IDBObjectStore.prototype.delete` 拋 UnknownError）
- 新檔 `src/screens/StudentDetail.test.tsx::…照片張數取不到時入口不顯示張數（Error Handling）`（spy `IDBIndex.prototype.count`）
三者都另外收集 `unhandledRejection`，並斷言檢視器仍開著、資料不變。
```
   × 學生詳情頁的照片紀錄本入口 > 照片張數取不到時入口不顯示張數（Error Handling） 168ms
     → expected [ Array(1) ] to deeply equal []
   × 照片紀錄本畫面 > 編輯或刪除失敗時顯示錯誤（Error Handling）：編輯 1052ms
     → Unable to find an element with the text: /無法儲存修改/. …
   × 照片紀錄本畫面 > 編輯或刪除失敗時顯示錯誤（Error Handling）：刪除 1045ms
     → Unable to find an element with the text: /無法刪除照片/. …
      Tests  3 failed | 9 passed (12)
```
失敗類型：功能未實作。`void updatePhoto(...)`、`void deletePhoto(...).then(onDeleted)`、`void countPhotos(...).then(...)` 的錯誤都變成未處理的 rejection，畫面沒有任何提示。
### Green
變更：
- `src/screens/StudentPhotos.tsx`：Viewer 改用 `saveEdit`／`confirmDelete`（try/catch）。
  - 編輯失敗：編輯表單保持開著，表單內顯示「無法儲存修改：<原因>」，可直接重試。
  - 刪除失敗：關閉確認表單，檢視器上顯示「無法刪除照片：<原因>」（role=alert）。
  - 新增 `errorText`，CSS 補 `.viewerError`。
- `src/screens/StudentDetail.tsx`：`countPhotos` 失敗時 `setPhotoCount(null)`，入口只顯示「照片紀錄本」。
```
 Test Files  13 passed (13)
      Tests  127 passed (127)
```
build 成功。

## Fix 3-4 — 一般存檔失敗丟掉變更（不限照片功能）
規格：`coverage.md` Error Handling 新增「一般資料（kv `state`）存檔失敗」條目，並註明這是整個 App 既有存檔機制的修正，不限於照片功能；`.feature` 新增 Scenario「存檔失敗時保留變更並持續警告（Error Handling）」。gherkin／coverage 門禁 PASS。
### Red
測試：新檔 `src/App.persist.test.tsx`（jsdom＋真正的 `<App />`；spy `IDBObjectStore.prototype.put` 拋 UnknownError）
- 主案例：修改 → 存檔失敗 → 應出現警告且無未處理的錯誤 → 寫入恢復後再存檔 → 讀得到修改、警告消失
- 變體「失敗期間又有新變更時保留較新的」：在失敗的 put 裡先做一次新修改，再拋錯
```
   × 存檔失敗 > 存檔失敗時保留變更並持續警告（Error Handling） 94ms
     → Internal error writing to the database.
   × 存檔失敗 > 存檔失敗時保留變更並持續警告（Error Handling）：失敗期間又有新變更時保留較新的 13ms
     → Internal error writing to the database.
      Tests  2 failed (2)
```
失敗類型：功能未實作。`flushPersist` 直接拋出寫入錯誤（計時器路徑會變成未處理的 rejection），而且寫入前已把 `pending` 清成 null，這筆變更無法重試。
### Green
變更：
- `src/store/useStore.ts`：新增 `persistError`。`flushPersist` 以 try/catch 包住 `saveState`：成功時清掉 `persistError`；失敗時 `pending ??= state`（期間已有較新的完整快照就保留新的），設定 `persistError`，不往外拋。superseded 時仍直接不寫入（修正輪 2 的邏輯不變）。
- 新增 `src/components/PersistErrorBanner.tsx`＋`.module.css`：不能關閉的常駐警告（role=alert）「資料沒有存進裝置：<原因>。請先匯出備份。」，放在 `AppShell` 最上方、備份提醒之前。
```
 Test Files  14 passed (14)
      Tests  129 passed (129)
```
突變檢查（把 `pending ??= state` 改成 `pending = state`，用舊快照蓋掉新變更，跑完即還原）：
```
   × …：失敗期間又有新變更時保留較新的 19ms
     → expected '舊名稱' to be '新名稱' // Object.is equality
```
還原後全套：`Tests 129 passed (129)`；build 成功。

## 修正輪 3 最終狀態
```
$ ec_gate.py gherkin student-photo-records  → PASS
$ ec_gate.py coverage student-photo-records → PASS
$ ec_gate.py tdd student-photo-records      → PASS
$ pnpm test → Test Files 14 passed (14) / Tests 129 passed (129)
$ pnpm build → 成功
```

---

# 修正輪 4（修正輪 3 第 4 項帶出的兩個 bug）

## Fix B-c1 — 存檔失敗與新存檔交錯時，舊快照覆蓋新資料
規格：`coverage.md` Error Handling 新增「存檔失敗與新的存檔交錯」條目（同屬 App 全域存檔機制）；`.feature` 新增 Scenario「存檔失敗不會讓較舊的資料覆蓋較新的資料（Error Handling）」。gherkin／coverage 門禁 PASS。
### Red
測試：新檔 `src/store/useStore.persist.test.ts`（照 verifier 的方法，以 `vi.doMock('./db')` 替換 `saveState`：第一次延遲 100ms 後失敗，之後成功並記錄「裝置上」的資料）。流程：改 S1 → `flushPersist()` 不 await → 改 S2 → 再 flush → 等兩者結束 → 再 flush 一次（模擬切到背景）。
```
   × 存檔串行化 > 存檔失敗不會讓較舊的資料覆蓋較新的資料（Error Handling） 105ms
     → expected 'S1' to be 'S2' // Object.is equality
```
失敗類型：功能未實作。S2 先寫入成功；S1 之後失敗，`pending` 被放回 S1；下一次 flush 就把 S1 寫進去，裝置倒退成舊資料，警告也被清掉。
### Green
變更：`src/store/useStore.ts` — `flushPersist` 串行化。新增 `inFlight`，進入時 `while (inFlight) await inFlight`，等前一個寫入結束才取當下的 `pending`。
設計理由：串行化後，S1 失敗時 `pending` 已是 S2，原本的 `pending ??= state` 就會保留 S2，不需要另外做版本比對；寫入失敗時警告一直留著，直到下一次寫入（最新狀態）成功才清除。讓出連線時 `unsavedState()` 取到的 `pending` 也一定是最新的。寫入本身的順序由一個 promise 保證，不另加佇列。
```
 Test Files  15 passed (15)
      Tests  130 passed (130)
```
build 成功。

## Fix B-c2 — 還原時存檔失敗仍顯示「已還原」
規格：`coverage.md` Error Handling 新增「還原 JSON 資料備份或復原匯入時寫入裝置失敗」條目（不限照片功能）；`.feature` 新增 Scenario「還原時存檔失敗不會顯示已還原（Error Handling）」。gherkin／coverage 門禁 PASS。
### Red
測試：新檔 `src/components/BackupPanel.test.tsx`（jsdom＋真正的 BackupPanel）。spy `IDBObjectStore.prototype.put`，只讓 key 為 `'state'` 的寫入失敗，回復點照常寫入。
- 「：還原資料備份」：選檔 → 覆蓋並還原
- 「：復原到匯入之前」：先成功還原一次，再讓寫入失敗後按「復原到匯入之前」
```
   × 資料備份區 > 還原時存檔失敗不會顯示已還原（Error Handling）：還原資料備份 1167ms
     → Unable to find an element with the text: /還原的資料沒有存進裝置：…/
   × 資料備份區 > 還原時存檔失敗不會顯示已還原（Error Handling）：復原到匯入之前 1076ms
     → Unable to find an element with the text: /還原的資料沒有存進裝置：…/
      Tests  2 failed (2)
```
失敗類型：功能未實作。`importState`／`rollbackImport` 在寫入失敗後照常 resolve，畫面顯示綠色的「已還原」「已復原」，與存檔失敗警告互相矛盾。
### Green
變更：
- `src/store/useStore.ts`：`importState`／`rollbackImport` 在 `flushPersist()` 後呼叫 `throwIfNotPersisted()`，若 `persistError` 非 null 就 reject。選擇 reject 是沿用既有 API 風格：`importState` 原本在寫回復點失敗時就是 reject；`rollbackImport` 的 boolean 表示「有沒有回復點」，不宜混入寫入結果。記憶體與常駐警告維持修正輪 3 的設計（`flushPersist` 本身仍不拋錯）。
- `src/components/BackupPanel.tsx`：`confirmImport` 與「復原到匯入之前」捕捉錯誤，顯示「還原的資料沒有存進裝置：<原因>。」，不顯示成功訊息。

第一次 Green 仍失敗，停下來查根因，沒有猜測修改。檢視輸出的 DOM：畫面其實已顯示「還原的資料沒有存進裝置：UnknownError: Internal error writing to the database.。」。多出的 `UnknownError: ` 來自 jsdom：jsdom 的 DOMException 不是 Node `Error` 的實例，`err instanceof Error` 為 false，改走 `String(err)`。真實瀏覽器的 DOMException 繼承 Error，不會有這個前綴。這是測試對原因字串寫得太死，Scenario 只要求「<原因>」，所以把比對放寬為 `/還原的資料沒有存進裝置：.*Internal error writing to the database\./`。
放寬後重新確認 Red 仍成立（暫時把 `useStore.ts`、`BackupPanel.tsx` 換回 HEAD 版本，跑完即還原）：
```
   × …：還原資料備份 1139ms → Unable to find an element with the text: /還原的資料沒有存進裝置：.*Internal error writing to the database\./
   × …：復原到匯入之前 1064ms → 同上
```
還原後全套：
```
 Test Files  16 passed (16)
      Tests  132 passed (132)
```
build 成功。

## 修正輪 4 最終狀態
```
$ ec_gate.py gherkin / coverage / tdd student-photo-records → 全部 PASS
$ pnpm test → Test Files 16 passed (16) / Tests 132 passed (132)
$ pnpm build → 成功
```

---

# 設計審查修正（依 design-review.md「使用者決定」）

## 單元 1 — 原圖另存 `photoBlobs` store
規格：
- `coverage.md`：Happy Path 新增照片、檢視原圖、照片很多時的資料需求，Error Handling 空間不足（同一交易），State 刪除與 v1→v2 升級，資料實體摘要。
- `.feature`：「新增一張照片（Happy Path）」加一行 Then（photos 只含中繼資料與 thumb，原圖存於 photoBlobs）；「照片依紀錄日期…（Edge Case）」改為「列表只讀取 photos 的 thumb，不讀取 photoBlobs 的原圖」；「儲存空間不足時該張不寫入」加「photoBlobs 中也只有 p1 的原圖」；「確認後刪除照片（State）」加「photoBlobs 中也不存在 p1 的原圖」；「資料庫升級保留既有資料（State）」加「photoBlobs 已建立」。
- `docs/schema.dbml`：photos 移除 blob、新增 `photoBlobs` 表（Note 指回 Scenario）與 `Ref: photoBlobs.photo_id - photos.id`；students Note 註明「日後若加入刪除學生，必須先決定照片的處理方式」。
- coverage／gherkin／dbml 門禁 PASS。

### Slice 1-1 schema
#### Red
`src/store/db.test.ts::資料庫升級保留既有資料（State）` 加入 photoBlobs 存在、out-of-line key、可存取 Blob 的斷言。
```
   × IndexedDB 結構 > 資料庫升級保留既有資料（State） 8ms
     → expected false to be true // Object.is equality
```
#### Green
`src/store/db.ts` 在 v2 的 `oldVersion < 2` 分支建立 `photoBlobs`（v2 尚未部署，不開 v3），匯出 `PHOTO_BLOBS_STORE`。全套 `Tests 132 passed (132)`。

### Slice 1-2 讀寫分開存放
#### Red
- 測試資料（fixture）改依新 schema 寫入：`seedPhotos` 把原圖寫到 photoBlobs；新增 `clearPhotoStores` 清兩個 store。這是 Given 的格式，不是 production code。
- 新增斷言：
  - 新增照片後直接讀兩個 store：photos 的記錄沒有 `blob`，photoBlobs 有原圖（2000x1500／0.85）
  - 空間不足後 photoBlobs 的 key 只有 p1
  - 刪除後 photoBlobs 沒有 p1
  - 列表只開 photos 的交易（spy `IDBDatabase.prototype.transaction`）
- 過程中我自己在 photoBackup.test 的 beforeEach 誤刪了 `db` 變數（`db is not defined`）。這屬測試自身錯誤，修正後才計入 Red。
```
   × 新增照片 > 新增一張照片（Happy Path） → expected { …(9) } to not have property "blob"
   × 無法處理的輸入 > 儲存空間不足時該張不寫入（Error Handling） → expected [] to deeply equal [ Array(1) ]
   × 匯出照片備份 > 匯出照片備份（Happy Path） → Cannot read properties of undefined (reading 'arrayBuffer')
   × 匯出照片備份 > 照片備份透過分享面板送出（Integration） → 同上
   × 匯出照片備份 > 取消分享時不算備份完成（Error Handling） → 同上
   × 匯入照片備份 > 匯出的備份可被匯入還原（Integration） → Cannot read properties of undefined (reading 'type')
   × 照片紀錄本畫面 > 檢視照片原尺寸（Happy Path） → Unable to find role="img"
   × 照片紀錄本畫面 > 確認後刪除照片（State） → expected Blob { size: 7, type: 'image/jpeg' } to be undefined
      Tests  8 failed | 124 passed (132)
```
失敗類型：功能未實作（原圖仍與中繼資料存在同一筆記錄；讀取端到 photos 找不到原圖）
#### Green
`src/store/photos.ts`：
- `putPhoto`：拆成 `photos.put(中繼資料＋縮圖)`＋`photoBlobs.put(原圖, id)`，放在同一個 readwrite 交易，空間不足判斷沿用。
- `deletePhoto`：同一交易刪兩邊。
- `getPhoto`／`listAllPhotos`：同一個唯讀交易補上原圖。
- `listPhotosByMonth`：只讀 photos。

第一次跑剩一個失敗：「匯入途中空間不足時保留已匯入的部分」以「放行 1 次 put」代表「只夠再存 1 張」，現在一張照片是兩次 put。把放行次數改為 2（仍是剛好一張），斷言不變。
```
 Test Files  16 passed (16)
      Tests  132 passed (132)
```
突變檢查（讓列表經由 `listAllPhotos` 讀取，跑完即還原）：
```
   × 紀錄本列表 > 照片依紀錄日期由新到舊並依月分組（Edge Case）
     → expected [ 'photos', 'photoBlobs' ] to not include 'photoBlobs'
```
build 成功。

## 單元 2 — 匯入時 `createdAt` 必須是 ISO 8601
規格：`coverage.md` 的「manifest 項目結構無效」條目寫明 `createdAt` 必須是 App 產生的 `toISOString()` 格式（並說明理由：列表同日排序直接比較字串）。`.feature` 的 Outline 新增 Example「manifest 中有 createdAt 不是 ISO 8601 的項目」。gherkin／coverage 門禁 PASS。
### Red
新增三個變體：空白分隔 `2026-09-01 10:00:00`、時區位移 `2026-09-01T18:00:00+08:00`、缺毫秒 `2026-09-01T10:00:00Z`。
同時把匯入測試的 Given `createdAt`（fixture 預設值與兩處字面值）改成 App 實際寫出的 `…T10:00:00.000Z`。這只是對齊資料格式，斷言不變；否則新規則會把合法的 Given 誤判為壞資料。
```
   × …：manifest 中有 createdAt 不是 ISO 8601 的項目（空白分隔） → expected true to be false
   × …：manifest 中有 createdAt 不是 ISO 8601 的項目（時區位移） → expected true to be false
   × …：manifest 中有 createdAt 不是 ISO 8601 的項目（缺毫秒）   → expected true to be false
      Tests  3 failed | 132 passed (135)
```
失敗類型：功能未實作（只檢查是否為字串）
### Green
`src/store/photoBackup.ts` 新增 `isAppIsoTimestamp`：`new Date(v).toISOString() === v`。
選擇理由：App 寫入的 `createdAt` 一律來自 `toISOString()`，匯出的備份也一定是這個格式。要求「解析後轉回來完全一致」可以同時擋下格式差異、時區寫法與溢位日期，並保證字串排序等於時間排序。代價是其他合法的 ISO 8601 寫法（帶時區位移、沒有毫秒）也會被拒；這些只可能來自人工編輯或其他程式，依「寧可拒絕」原則處理。
```
 Test Files  16 passed (16)
      Tests  135 passed (135)
```
build 成功。

## 單元 3a — 每位學生分開匯出照片備份
規格：
- `coverage.md`：Happy Path 的「匯出照片備份」改寫為逐位學生匯出（記下設計審查的理由）；Error Handling「取消分享」寫明依學生的 kv key；Integration 補「檔名含姓名與不允許字元的處理」與「匯入舊版全部照片備份」（說明 manifest 只加 `scope`、不提升 `schemaVersion` 的理由）；待決定段落註記備份時間改為每位學生記錄。
- `.feature`：「匯出照片備份（Happy Path）」「照片備份透過分享面板送出（Integration）」「匯出的備份可被匯入還原（Integration）」三個 Scenario 刪除，改寫成下列逐學生版本：
  - 照片備份區列出有照片的學生（Happy Path）
  - 匯出某位學生的照片備份（Happy Path）
  - 沒有任何照片時照片備份區顯示空狀態（Edge Case）
  - 照片備份處理中停用所有按鈕（Edge Case）
  - 學生照片備份透過分享面板送出（Integration）
  - 學生姓名含檔名不允許的字元時仍能匯出（Edge Case）
  - 匯出的學生照片備份可被匯入還原（Integration）
  - 舊版的全部照片備份仍可匯入（Integration）
  「取消分享時不算備份完成（Error Handling）」標題不變，內容改為 `photoBackupAt:s1`。
- `docs/schema.dbml`：kv key 改為 `photoBackupAt:<studentId>`／`photoBackupAt:unassigned`。
- coverage／gherkin／dbml 門禁 PASS。
- 被取代的三個舊 Scenario，其舊測試（呼叫已移除的 `exportPhotoBackup`）一併刪除，由下列新測試取代。

| Slice | 測試 | Red | Green |
|---|---|---|---|
| 3a-1 照片備份區列出有照片的學生（Happy Path） | `src/components/PhotoBackupPanel.test.tsx` | `Unable to find an element with the text: 王小明`（舊面板只有全部匯出） | `photos.ts` `countPhotosByStudent`（只讀 photos 的 studentId 索引 key cursor）；`db.ts` `loadPhotoBackupTime(owner)`；面板改為逐位學生列表（姓名、N 張 · 從未備份／今天／N 天前、匯出按鈕） |
| 3a-2 匯出某位學生的照片備份（Happy Path） | 同上（stub `navigator.canShare/share`、unzip 驗證 manifest、scope、只含 s1 圖檔、kv） | `Unable to find an element with the text: /已送出照片備份/`（匯出按鈕沒有動作） | `photoBackup.ts` 改為純函式 `buildPhotoBackup(photos, now, scope)`，manifest 加 `scope`，移除 `exportPhotoBackup`；`photos.ts` `listStudentPhotosWithBlobs`；`db.ts` 移除舊的單一 `photoBackupAt`，新增 `savePhotoBackupTime(owner, at)`；面板負責 `shareFile` 與非 cancelled 時記錄時間。離線測試改用與面板相同的組合步驟 |
| 3a-3 學生照片備份透過分享面板送出（Integration） | 同上 | `expected false to be true`（檔名沒有姓名） | `photoBackupFileName(now, scope)`：`bloomin-照片備份-<姓名或未歸屬>-YYYYMMDD-HHmm.zip` |
| 3a-4 學生姓名含檔名不允許的字元時仍能匯出（Edge Case） | `src/store/photoBackup.test.ts` | `expected 'bloomin-照片備份-A/B\C:D*E?F"G<H>I\|J-2026…' not to contain '/'` | 姓名中 `/ \ : * ? " < > \|` 換成 `_` |
| 3a-5 取消分享時不算備份完成（Error Handling） | 面板 | 第一次就綠：3a-2 的 Green 沿用了「非 cancelled 才記錄」 | 突變（拿掉判斷）→ `expected '2026-09-29T03:42:33.591Z' to be '2026-09-01T00:00:00.000Z'` |
| 3a-6 匯出的學生照片備份可被匯入還原（Integration） | store 層：`listStudentPhotosWithBlobs` → `buildPhotoBackup` → 清空 → 匯入 → 逐欄比對 | 第一次就綠 | 突變（打包不寫縮圖）→ `expected [] to deeply equal [ { studentId: 's1', …(8) }, …(1) ]` |
| 3a-7 舊版的全部照片備份仍可匯入（Integration） | store 層：沒有 scope、含兩位學生的 zip | 第一次就綠：匯入端本來就不讀 scope | 突變（匯入時要求 scope）→ 該測試（連同所有以舊格式 Given 的匯入測試）失敗 |
| 3a-8 沒有任何照片時照片備份區顯示空狀態（Edge Case） | 面板 | `Unable to find an element with the text: /還沒有任何照片/` | 空狀態說明文字 |
| 3a-9 照片備份處理中停用所有按鈕（Edge Case） | 面板（分享面板停住不回應） | 第一次就綠：3a-1 起所有按鈕即綁 `disabled={busy}` | 突變（學生列的匯出按鈕拿掉 disabled）→ `expected false to be true` |

清理：移除 photoBackup.test 中因舊匯出測試刪除而不再使用的輔助函式與舊 kv key 的清除。
```
 Test Files  17 passed (17)
      Tests  140 passed (140)
```
gherkin／coverage／tdd 門禁 PASS；build 成功。

## 單元 3b — 「未歸屬的照片」列（匯出與清除）
規格：`coverage.md` Happy Path 新增「照片備份區的未歸屬照片」（定義：studentId 不在目前 students 中；已封存學生不算），State 新增「清除未歸屬的照片」。`.feature` 新增 4 個 Scenario：
- 未歸屬的照片可以單獨匯出（Happy Path）
- 已封存學生的照片不算未歸屬（Edge Case）
- 清除未歸屬的照片需二次確認（State）
- 取消清除未歸屬的照片時照片保留（State）

gherkin／coverage 門禁 PASS。

| Slice | Red | Green |
|---|---|---|
| 3b-1 未歸屬的照片可以單獨匯出（Happy Path） | `Unable to find an element with the text: 未歸屬的照片` | `photos.ts` `listUnassignedPhotosWithBlobs(knownIds)`；面板把 studentId 不在 students 中的張數合成「未歸屬的照片 N 張」一列（0 張不顯示），匯出以 `scope: { kind: 'unassigned' }` 打包、kv `photoBackupAt:unassigned` |
| 3b-2 已封存學生的照片不算未歸屬（Edge Case） | 第一次就綠：3b-1 以 students 全體（含已封存）判斷 | 突變（把已封存學生排除在外）→ `Unable to find an element with the text: 王小明` |
| 3b-3 清除未歸屬的照片需二次確認（State） | `Unable to find role="button" and name "清除未歸屬的照片"` | `photos.ts` `deleteUnassignedPhotos(knownIds)`（photos＋photoBlobs 同一交易）；面板「清除」→ Sheet 說明無法復原並提示先還原資料備份 → 「清除照片」 |
| 3b-4 取消清除未歸屬的照片時照片保留（State） | 第一次就綠：3b-3 的「取消」只關閉 Sheet | 突變（按「清除」就直接刪）→ `expected undefined to be defined` |

```
 Test Files  17 passed (17)
      Tests  144 passed (144)
```
gherkin／coverage／tdd 門禁 PASS；build 成功。

## 單元 4 — 備份提醒與 README 說明照片需另外備份
規格：`coverage.md` Happy Path 新增「老師看到未備份的常駐提醒橫幅」條目；`.feature` 新增 Scenario「備份提醒說明照片需另外備份（Happy Path）」。gherkin／coverage 門禁 PASS。
### Red
測試：新檔 `src/components/BackupBanner.test.tsx`（有學生、從未備份，所以橫幅會出現）
```
   × 備份提醒橫幅 > 備份提醒說明照片需另外備份（Happy Path） 90ms
     → expected '尚未備份過資料刪除主畫面圖示或清除網站資料會讓紀錄消失且無法復原。' to contain '照片需另外在設定頁逐位學生備份'
```
失敗類型：功能未實作
### Green
- `src/components/BackupBanner.tsx`：說明文字末尾加「照片需另外在設定頁逐位學生備份。」，沿用既有的 detail 行，不改版面與出現條件。
- `README.md`「⚠️ 資料保存」補一段（文件，無測試）：照片不在 JSON 資料備份內；在「設定 → 照片備份」逐位學生匯出 zip（含未歸屬的照片）；換網址或換裝置時 JSON 與各學生的 zip 都要搬移，先還原 JSON 再逐一匯入 zip（只補不蓋）。
```
 Test Files  18 passed (18)
      Tests  145 passed (145)
```
build 成功。

## 單元 5 — ADR：持久化與資料庫升級規則
新增 `docs/decisions/0001-persistence-and-db-upgrades.md`，內容包括背景、六條決策（增量升級、blocked 提示、blocking 先寫後讓並擋住輸入、存檔串行化與失敗保留／常駐警告、還原寫入失敗 reject、照片與 state 分 store 且 JSON 備份不含照片）、後果（含仍待實機確認的項目）、下次修改 `DB_VERSION` 時的檢查清單，以及各規則對應的測試檔。純文件，無行為變更、無測試。

## 更正與修正 — 單元 1 引入的未處理 rejection（`pnpm test` 自 3631435 起以非零碼結束）
**更正**：單元 1 到單元 5 的 Green 紀錄寫「全綠」，但我只看了 `Tests N passed` 那一行，漏看了 `Errors 3 errors`。這段期間 `pnpm test` 實際以 exit=1 結束，那些「全綠」紀錄不正確。以 worktree 驗證：
```
3e2b7d8（單元 1 之前）  exit=0   Tests 132 passed (132)
3631435（單元 1）       exit=1   Tests 132 passed (132)   Errors 3 errors
```
### Red（最終檢查時的真實輸出）
```
⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
AbortError: A request was aborted, for example through a call to IDBTransaction.abort.
This error originated in "src/store/photoBackup.test.ts" … "空間不足以交易中止回報時同樣視為空間不足（Error Handling）：匯入"
（另兩個來自 src/store/photos.test.ts：交易中止形式的新增照片、非空間不足的交易中止）
      Tests  145 passed (145)
     Errors  3 errors
exit=1
```
根因（查證後才修改）：`putPhoto` 拆成兩個 store 後寫成 `Promise.all([photos.put(), photoBlobs.put(), tx.done])`。交易在第一個 put 之後就中止時，第二個 put 在組陣列時同步拋錯，`Promise.all` 沒有被呼叫，第一個 put 的 promise 就成了沒人處理的 AbortError。每次 putPhoto 失敗漏一個，共 3 個。真實瀏覽器的空間不足多半在 commit 時才非同步中止，但只要任一個 put 同步拋錯（例如 DataCloneError）就會發生同樣的洩漏，所以這是 production 的問題，不只是測試造成的。
### Green
`src/store/photos.ts` `putPhoto`：把已送出的請求收進陣列，失敗時對每個請求 `.catch(() => undefined)`，再照原邏輯等交易結束、依 `transaction.error` 判斷空間不足。
```
 Test Files  18 passed (18)
      Tests  145 passed (145)
exit=0
```
build 成功。

---

# 修正輪 5（verifier 推翻「同一交易保證整張」）

## Fix 5-1 — 寫入或刪除途中出錯時兩邊都不留下變更
規格：`coverage.md` Error Handling 新增「同一交易中的某個請求出錯」條目，並寫明同步拋錯不會讓交易自動中止。`.feature` 新增 Scenario Outline「寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）」，4 個 Examples：
- 新增照片時原圖 DataCloneError
- 新增照片時原圖 QuotaExceededError
- 刪除時原圖 UnknownError
- 清除未歸屬照片時第二張的刪除出錯

gherkin／coverage 門禁 PASS。
### Red
測試：`src/store/photos.test.ts::同一交易中的請求出錯 > 寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）：<Example>`。spy 只讓指定 store 的第 N 次 put／delete 同步拋錯，比對兩個 store 的原始內容，並收集未處理的 rejection。
```
   × …：新增一張照片、原圖 DataCloneError → expected { photos: [ …(4) ], …(1) } to deeply equal { …(2) }
   × …：新增一張照片、原圖 QuotaExceededError → expected { photos: [ …(4) ], …(1) } to deeply equal { …(2) }
   × …：刪除 p1、原圖 UnknownError → expected { photos: [ 'p8:s9', 'p9:s9' ], …(1) } to deeply equal { …(2) }
   × …：清除未歸屬的照片、第二張的刪除 UnknownError → expected { photos: [ 'p1:s1', 'p9:s9' ], …(1) } to deeply equal { …(2) }
      Tests  4 failed | 14 passed (18)     exit=1
```
失敗類型：功能未實作。catch 只等 `tx.done`，沒有 abort，同步拋錯前已送出的請求照樣 commit：
- 新增：photos 多了半筆，但沒有原圖
- 刪除：photos 已刪、原圖還在
- 清除：p8 已清、p9 還在
### Green
變更：`src/store/photos.ts` 新增 `allOrNothing(tx, work)`，`putPhoto`、`deletePhoto`、`deleteUnassignedPhotos` 都改用它。
- 任一請求失敗時，若交易尚未結束且沒有 `error`，就主動 `abort()`，撤銷所有已送出的請求。
- 已送出的請求全部接住。
- 等交易結束後，`transaction.error` 是空間不足就拋它，否則拋原錯誤。
```
 Test Files  18 passed (18)
      Tests  149 passed (149)      exit=0
```
突變檢查（各自跑完即還原）：
- 拿掉 `tx.abort()` → 4 個新測試全部失敗。
- 拿掉「仍在進行中才 abort」的判斷 → 兩個「空間不足以交易中止回報」測試丟出 `InvalidStateError`（交易已被瀏覽器中止，重複 abort），並出現 3 個未處理錯誤。

所以兩個判斷都有測試守護。

連帶修正：ADR 0001 決策 6 改寫為與實際行為一致。說明同一交易本身不保證整張，分別寫出非同步失敗（瀏覽器自行中止）與同步拋錯（必須主動中止）兩條路徑；檢查清單與測試對照表同步更新。build 成功。
