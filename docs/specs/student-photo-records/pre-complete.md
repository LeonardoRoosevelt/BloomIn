# Pre-complete Report — student-photo-records

日期：2026-09-29

## 判定：PASS

| 檢查 | 指令 | 結果 | 摘要 |
|---|---|---|---|
| ec gate: coverage | `ec_gate.py precomplete student-photo-records` | PASS | 六類齊全、無佔位字樣 |
| ec gate: gherkin | 同上 | PASS | 56 個 Scenario，皆有 Given/When/Then，六個必要標籤齊全 |
| ec gate: dbml | 同上（`npx @dbml/cli dbml2sql`） | PASS | 解析成功；修正 `record_date` 過時的 note 後重跑仍 PASS |
| ec gate: tdd | 同上 | PASS | 56 個 Scenario 標題皆出現在 22 個測試檔中 |
| ec gate: ui | 同上 | SKIP：本功能沒有 `design/`（未走 ui-options） | |
| 單元＋元件測試 | `pnpm test`（vitest，node＋jsdom 兩個 project） | PASS | exit=0；Test Files 18 passed、Tests 153 passed；無 Errors／Unhandled |
| 逐 commit 測試 | 對 `3e2b7d8..HEAD` 每個 commit 執行 `vitest run` | PASS | 9 個 commit 皆 exit=0、無 Errors（歷史整理後） |
| 整合測試 | — | SKIP：專案沒有獨立的整合測試層；IndexedDB 行為以 fake-indexeddb 在上列測試中涵蓋 | |
| E2E | — | SKIP：專案沒有 E2E 設定；sandbox 內無法啟動 Chrome。改列入下方「實機驗證」 | |
| lint | — | SKIP：專案未設定任何 linter（無 eslint／biome 設定，package.json 無 lint script） | |
| type check | `tsc -b` | PASS | exit=0，0 行輸出 |
| build | `pnpm build`（`tsc -b && vite build`） | PASS | exit=0；PWA precache 17 entries（394.42 KiB） |
| CI 相容 | `pnpm install --frozen-lockfile --offline` | PASS | exit=0，lockfile 與 package.json 一致 |
| DBML ↔ schema 對照 | 人工逐表（`src/store/db.ts` upgrade、`src/store/photos.ts`） | PASS | 見下表 |

## Warnings
- **iPhone 實機驗證尚未進行**（自動測試無法涵蓋）：
  - 真實 codec：HEIC、EXIF 直式照片方向、48MP 大圖的記憶體、Safari 對 `createImageBitmap` resize／orientation 選項的支援與退回路徑、透明 PNG 白底
  - 自製雙指縮放與雙擊放大
  - 分享面板逐位學生匯出、檔名在「檔案」App 的顯示；照片很多的學生打包的記憶體與耗時（仍是同步 `zipSync`）
  - Safari 空間不足的實際回報形式（同步拋錯或交易 abort）與兩個 store 整張不寫入
  - 舊分頁升級提示、被取代提示在主畫面 App 多工情境的行為
  - 存檔失敗警告與備份提醒同時出現時的版面；備份提醒多一句後的換行
  - App 切到背景時，串行化存檔對最後一筆寫入時效的影響
- 已知低嚴重度、未處理：還原失敗後需重新進入設定頁才會出現「復原到匯入之前」；還原在寫入前就失敗時錯誤文案不夠精確；檔名未替換 C1 控制字元與雙向文字覆寫字元（僅影響顯示）；非空間不足的交易中止在模擬中可能以較晚的 InvalidStateError 回報（不留下資料）。
- 歷史整理：單元 1 引入的 unhandled rejection 修正（原 `f8ad17c`）已併入 `e5a7913`，現在每個 commit 單獨測試皆通過。`tdd-log.md` 中「更正與修正」段落引用的是整理前的 commit hash（`3631435` 等），內容描述的事件本身不變。備份分支：`backup/pre-reword`、`backup/pre-fixup`。
- 本功能順帶修改全 App 的存檔與資料庫升級機制，決策見 `docs/decisions/0001-persistence-and-db-upgrades.md`。

## DBML ↔ 實際 schema
| 表 | DBML 有 | 實際有 | 差異 |
|---|---|---|---|
| kv | 是（key：state／selfcheck／rollback／photoBackupAt:&lt;studentId&gt;／photoBackupAt:unassigned） | 是（`STORE`，out-of-line key；`db.ts` 的 state、selfcheck、rollback 與 `photoBackupAt:${owner}`） | 無 |
| students | 是（邏輯實體，僅列 id、archived） | 是（存於 `kv['state'].students`，完整型別見 `src/domain/types.ts`） | 無（DBML 明示只列本功能引用欄位） |
| photos | 是（id PK、student_id、record_date、caption、thumb、width、height、created_at；index studentId） | 是（keyPath `id`、index `studentId`；`putPhoto` 寫入時拆掉 `blob`，其餘欄位同 DBML） | 無 |
| photoBlobs | 是（photo_id PK＝photos.id、blob） | 是（`PHOTO_BLOBS_STORE`，out-of-line key＝photo id，值為原圖 Blob） | 無 |

升級：`DB_VERSION = 2`，`oldVersion < 2` 分支同時建立 `photos`（含索引）與 `photoBlobs`；`origin/main` 仍是 v1，v2 尚未部署。

## Artifacts
- docs/specs/student-photo-records/coverage.md
- docs/specs/student-photo-records/student-photo-records.feature
- docs/schema.dbml
- docs/specs/student-photo-records/tdd-log.md
- docs/specs/student-photo-records/design-review.md
- docs/decisions/0001-persistence-and-db-upgrades.md
- docs/specs/student-photo-records/debug-*.md：無（未走 ec:debugging；除錯過程記在 tdd-log 各修正輪）

## 若 FAIL：指回
- 無
