# 0001 — 本機持久化與資料庫升級的規則

- 狀態：已採用（2026-09-29）
- 相關規格：`docs/specs/student-photo-records/`（coverage.md、.feature、design-review.md）
- 相關程式：`src/store/db.ts`、`src/store/useStore.ts`、`src/store/photos.ts`、`src/App.tsx`

## 背景

BloomIn 是單機離線 PWA，所有資料只存在這台裝置的 IndexedDB（資料庫 `bloomin`）。沒有伺服器可以回復，所以「寫進去了沒有」「會不會被舊資料蓋掉」「升級會不會卡死」都直接等於資料會不會遺失。

加入學生照片紀錄本時，資料庫從 v1 升到 v2，並陸續發現幾個與功能無關、但會讓整個 App 遺失資料或卡住的問題：

- 舊分頁開著時，升級會無限等待，畫面一片白。
- 升級後，本分頁被更新的版本取代時會遺失還在存檔延遲內的變更。
- 存檔失敗會被靜默丟棄。
- 存檔失敗與新的存檔交錯時，舊快照可能蓋掉新資料。
- 還原備份時寫入失敗，畫面卻顯示成功。

這些規則散在多個檔案裡，下一個修改 `DB_VERSION` 或存檔流程的人需要一個找得到的地方。

## 決策

1. **DB 以 `oldVersion` 增量升級。** `upgrade(db, oldVersion)` 依序執行 `if (oldVersion < N)` 分支，每一段只補上該版本新增的結構，不動既有 store 裡的資料。已部署的版本分支永遠不改；尚未部署的版本（例如開發中的 v2）可以直接修改自己的分支，不必另開新版本。
2. **升級被舊分頁擋住（`blocked`）時提示關閉舊分頁，而不是當成錯誤。** `db.ts` 透過 `onUpgradeBlocked` 通知，`useStore.hydrate` 期間設 `upgradeBlocked`，`App` 顯示「請關閉其他開著的 BloomIn 分頁」。舊連線一關，原本那個 `openDB` 就會完成，App 自動進入，不寫入 `hydrateError`。
3. **被更新的版本取代（`blocking`）時，先同步寫入未存的變更，再讓出連線並擋住輸入。** 在 versionchange 事件當下，用仍開著的連線同步建立交易 put 未存的 state，再 `close()`（close 會等已建立的交易完成）。之後 `superseded` 為 true，`App` 以全螢幕提示取代所有畫面（不自動重新載入），`flushPersist` 不再嘗試寫入。
4. **存檔串行化；失敗時保留變更並常駐警告。**
   - 同一時間只有一個 `saveState` 進行中，後到的存檔等前一個結束，再寫當下最新的 `pending`，所以裝置上的資料不會被比已成功寫入的版本更舊的快照覆蓋。
   - 寫入失敗時把快照放回 `pending`（期間已有較新的就保留新的），設定 `persistError`，由 `PersistErrorBanner` 常駐顯示「資料沒有存進裝置…請先匯出備份」，下次成功寫入後自動消失。
   - `flushPersist` 本身不拋錯，因為呼叫端多是計時器或頁面事件，拋出只會變成沒人處理的錯誤。
5. **還原類操作寫入失敗要 reject。** `importState`／`rollbackImport` 在存檔後若仍有 `persistError` 就 reject，畫面顯示「還原的資料沒有存進裝置」，不顯示成功訊息。
6. **照片與 state 分 store；JSON 資料備份不含照片。**
   - 領域資料是 kv 的單一 `state` JSON。照片中繼資料與縮圖在 `photos`，原圖在 `photoBlobs`（key 同照片 id）。
   - 新增、刪除一張照片與清除未歸屬照片，都在同一個 readwrite 交易裡，並經由 `photos.ts` 的 `allOrNothing` 保證「整張（或整批）要嘛都成功、要嘛都不變」。同一個交易本身並不保證這件事，要分兩條路徑處理：
     - **非同步失敗**（請求送出後失敗，或 commit 時空間不足）：瀏覽器自行中止交易，撤銷已送出的請求；交易的 `error` 說明原因（空間不足時請求端只看到 `AbortError`，要讀 `transaction.error`）。
     - **同步拋錯**（例如原圖無法複製的 `DataCloneError`、同步的 `QuotaExceededError`）：交易**不會**自動中止，前面已送出的請求照樣會 commit。所以任何失敗都主動 `abort()` 仍在進行中的交易；已結束或已有 `error` 的交易不再 abort（重複呼叫會丟 `InvalidStateError`）。
   - 已送出的請求在中止後都會 reject，全部接住，錯誤統一回報：交易的 `error` 是空間不足就拋它，否則拋原錯誤。
   - 照片另有逐位學生的 zip 備份，備份時間記在 kv `photoBackupAt:<studentId>`／`photoBackupAt:unassigned`，不進 `AppState`，也不動 `SCHEMA_VERSION`。

## 後果

- 好處：升級、讓出連線、存檔失敗、還原失敗都有明確的畫面與可重試的狀態，不會靜默遺失。照片體積不影響日常存檔與 JSON 備份。
- 代價：
  - 存檔串行化後，某次寫入若卡住，之後的存檔都會跟著等。IndexedDB 的寫入正常一定會結束，但這是需要知道的前提。
  - 被取代的分頁只能重新載入才能繼續使用。
  - 存檔失敗後的重試要等下一次變更或頁面切到背景，沒有自動定時重試。
  - 老師必須分別備份資料（JSON）與照片（每位學生一份 zip），所以提醒橫幅與 README 都要說明。
- 仍待實機確認：iOS Safari 回報空間不足的形式、加入主畫面後多工畫面裡的舊分頁行為、單一學生照片極多時打包 zip 的記憶體用量。

## 下次修改 `DB_VERSION` 時的檢查清單

- [ ] 新結構只放在新的 `if (oldVersion < 新版本)` 分支；已部署版本的分支一行都不改。
- [ ] `db.test.ts` 先建立上一版的資料庫並寫入資料，再以新版本開啟，確認舊資料完整保留、新結構存在。
- [ ] 舊分頁仍開著時，新版本會收到 `blocked`，畫面要出現關閉舊分頁的提示，舊連線關閉後自動完成（`src/App.test.tsx`）。
- [ ] 本版開著時，更新的版本開啟不會被擋住（`src/store/db.test.ts`「本分頁不會擋住較新版本的升級」）。
- [ ] 讓出連線時未存的變更有寫進去，畫面擋住輸入且沒有未處理的錯誤（`src/App.superseded.test.tsx`）。
- [ ] 新增的 store 若與既有 store 有關聯（例如 `photos`／`photoBlobs`），新增與刪除放在同一個交易並經由 `allOrNothing`（同步拋錯也要主動中止），測試要涵蓋非同步失敗與同步拋錯兩種（`src/store/photos.test.ts`）。
- [ ] 若更動 kv 的 key 或 `AppState`，確認 JSON 備份格式與 `SCHEMA_VERSION` 是否需要一起處理；照片相關的 key 不進 `AppState`。
- [ ] 同步更新 `docs/schema.dbml` 的 Project Note 版本號與各表 Note，並跑 `ec_gate.py dbml`。

## 相關測試

| 規則 | 測試 |
|---|---|
| 增量升級、保留 kv 資料、建立 photos／photoBlobs | `src/store/db.test.ts` |
| blocked 時提示並自動完成 | `src/App.test.tsx` |
| blocking 時讓出連線 | `src/store/db.test.ts` |
| 讓出前寫入 pending、擋住輸入、不再寫入 | `src/App.superseded.test.tsx` |
| 存檔失敗保留變更、常駐警告、恢復後消失 | `src/App.persist.test.tsx` |
| 存檔串行化，舊快照不覆蓋新資料 | `src/store/useStore.persist.test.ts` |
| 還原寫入失敗時不顯示成功 | `src/components/BackupPanel.test.tsx` |
| 照片兩個 store 同一交易、空間不足（含交易中止形式） | `src/store/photos.test.ts`、`src/store/photoBackup.test.ts` |
| 請求同步拋錯時整張／整批都不變（全有或全無） | `src/store/photos.test.ts`「寫入或刪除途中出錯時兩邊都不留下變更」 |
| 還原資料備份不影響照片 | `src/store/photos.test.ts` |
