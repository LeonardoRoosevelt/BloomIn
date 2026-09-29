# Feature Coverage Analysis — 學生照片紀錄本

- slug: `student-photo-records`
- 需求原文：目前需要增加各個學生的照片紀錄本功能，來保存過去的紙本紀錄。
- 已確認的決策（2026-09-29 使用者拍板）：
  - 照片以 Blob 存於獨立的 IndexedDB object store，**不進** `AppState`（避免每次存檔重寫整包、避免現有 JSON 備份暴增）。
  - 照片另有獨立備份檔（zip），與現有 JSON 備份分開匯出／匯入。
  - 每張照片記錄「紀錄日期」與「文字說明」。
  - 上傳時縮到長邊 2000px、輸出 JPEG。
  - 可刪除，需二次確認。
- 相關既有元件：
  - `src/store/db.ts`：IndexedDB `bloomin` v1，只有 `kv` store（單筆 `state` JSON、`selfcheck`、`rollback`）。本功能需升到 v2 並新增 store。
  - `src/domain/types.ts`：`Student`（`id`, `archived`）。照片以 `studentId` 參照學生；學生只能封存、不能刪除。
  - `src/screens/StudentDetail.tsx`：照片紀錄本的入口放在學生詳情頁。
  - `src/components/BackupPanel.tsx` + `src/store/backup.ts`：現有 JSON 備份（信封 `app: 'bloomin'` + `schemaVersion` 的防呆模式，照片備份沿用同樣思路）。
  - `src/lib/share.ts` `shareFile()`：匯出檔案走原生分享面板、退回下載。
  - `src/store/db.ts` `storageEstimate()` / `requestPersistence()`：顯示用量。
  - `src/components/ui/Sheet.tsx`、`Button`、`EmptyState`、`Field`：UI 元件。

### 1. Happy Path
- 情境：老師在某位學生的詳情頁 → 點「照片紀錄本」→ 新增照片（從相簿選或用相機拍）→ 填紀錄日期與說明 → 儲存
  - 預期行為：照片縮到長邊 ≤ 2000px 的 JPEG 後存入；紀錄本列表出現縮圖、日期、說明；關閉並重開 App 後仍在。
  - 資料需求：`photo.id`（PK）、`photo.studentId`（not null，參照 `Student.id`，索引）、`photo.recordDate`（not null，YYYY-MM-DD）、`photo.caption`（not null，可為空字串）、`photo.blob`（not null，image/jpeg）、`photo.width` / `photo.height`（not null）、`photo.createdAt`（not null，ISO）。
- 情境：一次選取多張照片（例如一整本紙本簽到簿翻拍）
  - 預期行為：每張各自成為一筆紀錄，預設共用同一個紀錄日期與空白說明；之後可逐張編輯。
  - 資料需求：同上，每張一筆 `photo`。
- 情境：開啟某張照片
  - 預期行為：全螢幕檢視原尺寸（≤2000px），可雙指縮放看清手寫字跡；顯示日期與說明。
  - 資料需求：讀取 `photo.blob`。
- 情境：編輯既有照片的紀錄日期或說明
  - 預期行為：列表立即反映；照片本身不變。
  - 資料需求：更新 `photo.recordDate`、`photo.caption`。
- 情境：在設定 → 備份頁按「匯出照片備份」
  - 預期行為：產生一個 zip（內含每張 JPEG 與一份 manifest JSON：`app: 'bloomin-photos'`、`schemaVersion`、`exportedAt`、每張照片的中繼資料）；交給 `shareFile()` 送出。
  - 資料需求：讀取全部 `photo`；manifest 欄位與 `photo` 中繼資料一一對應。
- 情境：在新裝置先還原 JSON 備份、再匯入照片備份 zip
  - 預期行為：照片全部回到各自學生的紀錄本；顯示「已匯入 N 張」。
  - 資料需求：`photo.id` 保留原值寫回。

### 2. Edge Cases
- 情境：學生還沒有任何照片
  - 預期行為：紀錄本顯示空狀態與「新增照片」按鈕。
  - 資料需求：以 `photo.studentId` 查詢結果為空。
- 情境：紀錄本照片很多（例如 200 張）
  - 預期行為：列表用縮圖顯示、不一次解碼 200 張 2000px 原圖；依 `recordDate` 由新到舊排序，同日依 `createdAt`；依月份分組（與學生詳情頁出席明細同樣的月份分組呈現）。
  - 資料需求：`photo.thumb`（not null，長邊約 400px JPEG Blob），避免列表載入原圖；`photo.studentId` 索引。
- 情境：原圖本身長邊已 ≤ 2000px
  - 預期行為：不放大，維持原尺寸，仍轉成 JPEG。
  - 資料需求：`photo.width` / `photo.height` 記錄實際輸出尺寸。
- 情境：iPhone 拍的 HEIC、或帶 EXIF 旋轉資訊的直式照片
  - 預期行為：存下來的方向與相簿看到的一致（不會橫倒）。
  - 資料需求：無額外欄位（旋轉在縮圖時烘焙進像素）。
- 情境：紀錄日期是很久以前（例如 2019 年的紙本）或未來日期
  - 預期行為：過去日期正常接受；日期欄位允許任意合法日期，不限制範圍。
  - 資料需求：`photo.recordDate` 只驗證格式。
- 情境：已封存的學生
  - 預期行為：照片仍可檢視、新增、編輯、刪除（封存只是從清單隱藏）。
  - 資料需求：不看 `Student.archived`。
- 情境：重複匯入同一份照片備份 zip
  - 預期行為：已存在的 `photo.id` 跳過，不會產生重複照片；顯示「新增 N 張、略過 M 張已存在」。
  - 資料需求：`photo.id` unique（object store keyPath）。
- 情境：先匯入照片備份、後才還原 JSON 備份（順序顛倒），或照片所屬學生不存在於目前資料
  - 預期行為：照片照樣存入（不丟棄）；匯入結果訊息註明「其中 K 張屬於目前找不到的學生，還原對應的資料備份後就會出現」。
  - 資料需求：`photo.studentId` 不做強制 FK 檢查（IndexedDB 無 FK；刻意允許暫時孤立）。
- 情境：還原 JSON 備份（`importState`）或「復原匯入」（`rollbackImport`）
  - 預期行為：不動照片 store；照片與 state 各自獨立。
  - 資料需求：無。
- 情境：快速連點「儲存」
  - 預期行為：只存一次（按鈕在處理中停用）。
  - 資料需求：無。

### 3. Error Handling
- 情境：選到非圖片檔、或瀏覽器無法解碼的圖片
  - 預期行為：該張顯示「無法讀取這個檔案」並略過，其他張照常存入；不留下殘缺紀錄。
  - 資料需求：無（解碼失敗不寫入）。
- 情境：儲存空間不足（IndexedDB `QuotaExceededError`）
  - 預期行為：顯示「裝置儲存空間不足，這張照片沒有存進去」；已存的照片不受影響；該筆不寫入。
  - 資料需求：單張寫入是單一交易（blob 與 thumb 同一筆 put），不會寫一半。
- 情境：匯入的 zip 不是 BloomIn 照片備份（manifest 缺失、`app` 不符）、manifest 版本比 App 新、或 zip 損壞
  - 預期行為：整份拒絕並說明原因，不寫入任何照片（沿用 `parseBackup` 的「寧可拒絕」原則）。
  - 資料需求：manifest `app`、`schemaVersion` 驗證。
- 情境：manifest 中任何一筆項目結構無效 —— 欄位缺漏或型別錯誤（`id`、`studentId` 不是非空字串；`recordDate` 不是 YYYY-MM-DD；`caption`、`createdAt` 不是字串；`width`、`height` 不是正整數），或項目的檔案路徑不在 `photos/`（原圖）、`thumbs/`（縮圖）之下（例如指向 `manifest.json`）
  - 預期行為：整份拒絕並說明是哪一筆有問題，一張都不寫入（驗證在寫入第一張之前完成）。與「manifest 列出的照片檔案缺失」區分：項目結構合法、只是 zip 裡沒有那個圖檔時，仍是略過該張。
  - 資料需求：逐筆驗證 manifest 項目欄位，對應 `photos` store 的 not null 欄位；檔案查找只看 zip 本身的項目（own property），不受物件原型鏈影響。
- 情境：zip 中 manifest 列出的照片檔案缺失
  - 預期行為：該張略過並計入「略過（檔案缺失）」數量，其他照常匯入。
  - 資料需求：無。
- 情境：匯入途中空間不足
  - 預期行為：停止，回報「已匯入 N 張，剩下 M 張因空間不足未匯入」；已匯入的保留（重跑匯入會因 id 已存在而跳過，可接續）。
  - 資料需求：`photo.id` unique。
- 情境：匯出時分享面板被取消
  - 預期行為：顯示「已取消，這次沒有備份照片」，不視為備份完成。
  - 資料需求：無。
- 情境：學生 id 不存在（直接開到壞連結）
  - 預期行為：沿用學生詳情頁的「找不到這位學生」空狀態。
  - 資料需求：無。
- 情境：開啟紀錄本時讀取照片失敗（IndexedDB 讀取錯誤，例如瀏覽器儲存區異常）
  - 預期行為：顯示「無法讀取照片」的錯誤訊息，不是空白畫面，也不能誤顯示「還沒有照片」的空狀態（那會讓老師以為照片不見了而重拍或放棄）。
  - 資料需求：無。

### 4. Permission/Access
- 無：因為 BloomIn 是單人單機離線 App，沒有帳號或權限概念；照片只存在本機、不上傳任何伺服器（與 README 的隱私承諾一致）。相機／相簿存取由瀏覽器原生檔案選擇器處理，App 不另外要求權限。

### 5. State Transitions
- 情境：照片生命週期 `不存在 → 已存 → 已刪除`
  - 預期行為：刪除需二次確認（確認對話框說明「刪除後無法復原，除非有照片備份」）；確認後從 store 移除，列表立即更新。取消則不變。
  - 資料需求：刪除為實體刪除（照片不牽涉帳務，不需要封存）。
- 情境：刪除後再匯入含該張的照片備份
  - 預期行為：該張重新出現（id 已不存在，視為新增）。
  - 資料需求：`photo.id`。
- 情境：IndexedDB 由 v1 升級到 v2
  - 預期行為：既有 `kv` store 與 `state` 資料完整保留，僅新增 `photos` store 與 `studentId` 索引。
  - 資料需求：`DB_VERSION` 1 → 2；`upgrade()` 依 `oldVersion` 增量建立。
- 情境：升級時還有舊版 App 的分頁／視窗開著（舊版沒有處理 versionchange，連線不會自己關）
  - 預期行為：升級被擋住時不能無限等待而停在白畫面；顯示可理解的提示（「請關閉其他開著的 BloomIn 分頁」）。這不是讀取失敗，不能進入錯誤狀態、也不能讓人開始輸入；舊連線一關閉，升級自動完成、畫面自動進入 App，`kv` 的資料完整保留。
  - 資料需求：`openDB` 的 `blocked` 事件回報給載入流程。
- 情境：本版開著時，另一個分頁以更新的資料庫版本開啟（日後 v2 → v3）
  - 預期行為：本分頁主動關閉連線讓升級進行，不重演「舊分頁擋住新版」的問題。
  - 資料需求：`openDB` 的 `blocking` 事件中關閉連線。
- 情境：本分頁讓出連線（被較新版本取代）的當下，還有尚未寫入的變更（例如剛輸入、仍在 300ms 存檔延遲內）
  - 預期行為：讓出前先在仍開著的連線上寫入這筆變更，較新版本開啟後讀得到它；讓出後本分頁已無法讀寫，畫面改為全螢幕提示「BloomIn 已在其他分頁更新，請重新開啟 App」並提供「重新載入」，擋住所有輸入，不能讓人繼續輸入然後靜默遺失；之後不再嘗試寫入、不產生未處理的錯誤。不自動重新載入，避免老師正在看的畫面無預警消失。
  - 資料需求：`blocking` 事件中同步取得未寫入的 state，在同一條連線上建立寫入交易後才 `close()`（close 會等已建立的交易完成）。

### 6. Integration Points
- 情境：`shareFile()` 匯出照片備份 zip
  - 預期行為：iOS 走原生分享面板；不支援時退回下載；取消回傳 `cancelled`（見 Error Handling）。
  - 資料需求：無。
- 情境：zip 產生／解析（需要 zip 編解碼能力，目前專案沒有相關依賴）
  - 預期行為：照片已是 JPEG，zip 採 store（不壓縮）即可；大量照片時不讓畫面卡死（顯示進度或處理中狀態）。失敗時顯示錯誤，不寫入任何照片。
  - 資料需求：無。
- 情境：`storageEstimate()` 顯示空間用量
  - 預期行為：照片紀錄本或備份頁顯示目前用量／配額，讓老師知道快滿了。取不到時不顯示，不報錯。
  - 資料需求：無。
- 情境：瀏覽器圖片解碼與 canvas 縮圖（`createImageBitmap` / `<canvas>.toBlob`）
  - 預期行為：iOS canvas 有像素上限，超大原圖需先縮再畫；失敗走 Error Handling 的「無法讀取」。
  - 資料需求：無。
- 情境：Service Worker / 離線
  - 預期行為：功能全在本機，離線完全可用。
  - 資料需求：無。

## 待使用者決定
- 無。以下細節已於 2026-09-29 由使用者確認「照預設」：
  - 紀錄日期精確到日（YYYY-MM-DD），新增時預設今天；列表依月分組。
  - v1 不做照片備份提醒；備份頁顯示「上次照片備份時間」，存於 IndexedDB `kv`（key `photoBackupAt`），不進 AppState。
  - zip 使用 `fflate`，store 模式（不壓縮）。
  - 縮圖長邊 400px、JPEG 品質 0.7；原圖長邊 2000px、JPEG 品質 0.85。
  - 照片紀錄本為獨立子頁面（路由 `student-photos`），學生詳情頁放入口與張數。

## 資料實體摘要
- 新增：IndexedDB object store `photos`（keyPath `id`，index `studentId`），欄位 `id`, `studentId`, `recordDate`, `caption`, `blob`, `thumb`, `width`, `height`, `createdAt`。
- 新增：照片備份 zip 格式（`manifest.json` + `photos/<id>.jpg`），manifest 信封 `app: 'bloomin-photos'`, `schemaVersion`, `exportedAt`, `photos[]`。
- 修改：`src/store/db.ts` `DB_VERSION` 1 → 2。
- 不修改：`AppState`、`SCHEMA_VERSION`、現有 JSON 備份格式。
