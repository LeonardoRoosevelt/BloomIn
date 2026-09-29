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
