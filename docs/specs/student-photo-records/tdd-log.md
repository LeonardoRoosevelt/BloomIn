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
