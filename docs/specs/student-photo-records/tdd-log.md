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
