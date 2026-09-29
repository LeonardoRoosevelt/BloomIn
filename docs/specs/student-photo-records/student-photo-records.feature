Feature: 學生照片紀錄本
  老師可以替每位學生保存紙本紀錄的照片（例如翻拍的簽到簿、作品紀錄卡），
  依紀錄日期整理，並能獨立備份與還原，不影響既有的學生與帳務資料。

  Rule: 照片以縮圖後的 JPEG 存在本機，附紀錄日期與說明

    # coverage: Happy Path / 新增照片並填日期與說明
    @happy-path
    Scenario: 新增一張照片（Happy Path）
      Given students 中存在 id 為 "s1" 的學生
      And photos 中沒有 studentId 為 "s1" 的記錄
      When 老師替學生 "s1" 新增一張 4000x3000 的照片，recordDate 為 "2024-03-15"，caption 為 "上學期簽到卡 第 1 頁"
      Then photos 新增一筆 studentId 為 "s1" 的記錄
      And 該記錄的 recordDate 為 "2024-03-15"、caption 為 "上學期簽到卡 第 1 頁"
      And 該記錄的 blob 為 image/jpeg，width 為 2000、height 為 1500
      And 該記錄同時帶有長邊為 400 的 thumb

    # coverage: Happy Path / 一次選取多張照片
    @happy-path
    Scenario: 一次新增多張照片（Happy Path）
      Given students 中存在 id 為 "s1" 的學生
      When 老師替學生 "s1" 一次新增 3 張照片，recordDate 為 "2024-03-15"
      Then photos 新增 3 筆 studentId 為 "s1" 的記錄
      And 3 筆的 recordDate 皆為 "2024-03-15"、caption 皆為空字串

    # coverage: Happy Path / 開啟某張照片檢視原尺寸
    @happy-path
    Scenario: 檢視照片原尺寸（Happy Path）
      Given photos 中存在 id 為 "p1"、width 為 2000 的記錄
      When 老師開啟照片 "p1"
      Then 顯示的是 "p1" 的 blob 而非 thumb
      And 同時顯示該照片的 recordDate 與 caption

    # coverage: Happy Path / 編輯紀錄日期或說明
    @happy-path
    Scenario: 編輯照片的日期與說明（Happy Path）
      Given photos 中存在 id 為 "p1"、recordDate 為 "2024-03-15"、caption 為 "" 的記錄
      When 老師把 "p1" 的 recordDate 改為 "2023-09-01"、caption 改為 "舊簽到簿"
      Then "p1" 的 recordDate 為 "2023-09-01"、caption 為 "舊簽到簿"
      And "p1" 的 blob 與 thumb 不變

  Rule: 紀錄本依紀錄日期整理

    # coverage: Edge Cases / 學生還沒有任何照片
    @edge-case
    Scenario: 沒有照片時顯示空狀態（Edge Case）
      Given photos 中沒有 studentId 為 "s1" 的記錄
      When 老師開啟學生 "s1" 的照片紀錄本
      Then 顯示空狀態與新增照片的入口

    # coverage: Edge Cases / 照片很多時依日期排序、依月分組、只載縮圖
    @edge-case
    Scenario: 照片依紀錄日期由新到舊並依月分組（Edge Case）
      Given photos 中學生 "s1" 有以下記錄
        | id | recordDate | createdAt            |
        | p1 | 2024-03-15 | 2026-09-01T10:00:00Z |
        | p2 | 2024-05-02 | 2026-09-01T10:00:00Z |
        | p3 | 2024-03-15 | 2026-09-02T10:00:00Z |
      When 老師開啟學生 "s1" 的照片紀錄本
      Then 分組依序為 "2024-05"、"2024-03"
      And "2024-03" 組內依序為 p3、p1
      And 列表只讀取 thumb，不讀取 blob

    # coverage: Edge Cases / 原圖長邊已 ≤ 2000px
    @edge-case
    Scenario: 小於上限的照片不放大（Edge Case）
      Given students 中存在 id 為 "s1" 的學生
      When 老師替學生 "s1" 新增一張 1200x800 的照片
      Then 該記錄的 width 為 1200、height 為 800
      And 該記錄的 blob 為 image/jpeg

    # coverage: Edge Cases / 直式照片的方向
    @edge-case
    Scenario: 直式照片的方向與相簿一致（Edge Case）
      Given 一張帶有 EXIF 旋轉 90 度資訊、像素為 4000x3000 的照片
      When 老師替學生 "s1" 新增這張照片
      Then 該記錄的 width 為 1500、height 為 2000

    # coverage: Edge Cases / 很久以前的紀錄日期
    @edge-case
    Scenario: 接受任意合法的紀錄日期（Edge Case）
      Given students 中存在 id 為 "s1" 的學生
      When 老師替學生 "s1" 新增一張照片，recordDate 為 "2019-01-05"
      Then 該記錄的 recordDate 為 "2019-01-05"

    # coverage: Edge Cases / 已封存學生
    @edge-case
    Scenario: 已封存學生的紀錄本照常可用（Edge Case）
      Given students 中學生 "s1" 的 archived 為 true
      When 老師替學生 "s1" 新增一張照片
      Then photos 新增一筆 studentId 為 "s1" 的記錄

    # coverage: Edge Cases / 還原 JSON 備份或復原匯入不動照片
    @edge-case
    Scenario: 還原資料備份不影響照片（Edge Case）
      Given photos 中存在 id 為 "p1" 的記錄
      When 老師還原一份 JSON 資料備份，或執行復原匯入
      Then photos 中仍存在 id 為 "p1" 的記錄

    # coverage: Edge Cases / 快速連點儲存
    @edge-case
    Scenario: 儲存處理中不會重複寫入（Edge Case）
      Given 老師正在替學生 "s1" 新增一張照片
      When 老師在新增照片儲存處理中再次按下儲存
      Then photos 只新增一次記錄

  # coverage: Permission/Access / 單人單機，無權限概念
  @permission
  Scenario: 照片只存在本機且不需登入（Permission）
    Given App 為單人單機使用，沒有帳號
    When 老師新增或匯出照片
    Then 不會有任何照片資料送往伺服器
    And 操作不需要登入

  Rule: 無法處理的輸入不留下殘缺紀錄

    # coverage: Error Handling / 非圖片或無法解碼
    @error
    Scenario: 無法解碼的檔案被略過（Error Handling）
      Given students 中存在 id 為 "s1" 的學生
      When 老師替學生 "s1" 一次新增 2 張照片，其中 1 個檔案無法解碼為圖片
      Then photos 只新增 1 筆記錄
      And 回報 1 個檔案無法讀取

    # coverage: Error Handling / 儲存空間不足
    @error
    Scenario: 儲存空間不足時該張不寫入（Error Handling）
      Given photos 中存在 id 為 "p1" 的記錄
      And 裝置儲存空間已滿
      When 老師替學生 "s1" 新增一張照片
      Then 回報「裝置儲存空間不足」
      And photos 中仍只有 "p1"

    # coverage: Error Handling / 學生 id 不存在
    @error
    Scenario: 學生不存在時顯示找不到（Error Handling）
      Given students 中不存在 id 為 "ghost" 的學生
      When 老師開啟學生 "ghost" 的照片紀錄本
      Then 顯示「找不到這位學生」

    # coverage: Error Handling / 讀取照片失敗
    @error
    Scenario: 讀取照片失敗時顯示錯誤（Error Handling）
      Given students 中存在 id 為 "s1" 的學生
      And 瀏覽器讀取 photos 時發生錯誤
      When 老師開啟學生 "s1" 的照片紀錄本
      Then 顯示「無法讀取照片」的錯誤訊息
      And 不顯示「還沒有照片」的空狀態

  Rule: 照片備份是獨立的 zip，匯入只做合併且絕不覆蓋

    # coverage: Happy Path / 匯出照片備份
    @happy-path
    Scenario: 匯出照片備份（Happy Path）
      Given photos 中有 2 筆記錄 "p1"、"p2"
      When 老師匯出照片備份
      Then 產生的 zip 含 manifest.json，其 app 為 "bloomin-photos" 且列出 "p1"、"p2" 的中繼資料
      And zip 含 photos/p1.jpg 與 photos/p2.jpg
      And kv 的 photoBackupAt 更新為匯出時間

    # coverage: Happy Path / 新裝置先還原 JSON 再匯入照片
    @happy-path
    Scenario: 匯入照片備份（Happy Path）
      Given photos 為空
      And 一份含 "p1"、"p2" 的照片備份 zip
      When 老師匯入這份照片備份
      Then photos 中存在 "p1"、"p2"，且欄位與 manifest 一致
      And 回報新增 2 張

    # coverage: Edge Cases / 重複匯入同一份備份
    @edge-case
    Scenario: 已存在的照片在匯入時略過（Edge Case）
      Given photos 中存在 id 為 "p1"、caption 為 "本機版本" 的記錄
      And 一份含 "p1"（caption 為 "備份版本"）與 "p2" 的照片備份 zip
      When 老師匯入這份照片備份
      Then "p1" 的 caption 仍為 "本機版本"
      And photos 新增 "p2"
      And 回報新增 1 張、略過 1 張已存在

    # coverage: Edge Cases / 照片所屬學生不存在
    @edge-case
    Scenario: 找不到所屬學生的照片仍會匯入（Edge Case）
      Given students 中不存在 id 為 "s9" 的學生
      And 一份含 studentId 為 "s9" 的照片 "p9" 的照片備份 zip
      When 老師匯入這份照片備份
      Then photos 中存在 "p9"
      And 回報其中 1 張屬於目前找不到的學生

    # coverage: Error Handling / 不是 BloomIn 照片備份、版本過新、zip 損壞、manifest 項目結構無效
    @error
    Scenario Outline: 無效的照片備份被整份拒絕（Error Handling）
      Given photos 中存在 id 為 "p1" 的記錄
      When 老師匯入一份 <問題> 的檔案
      Then 匯入被拒絕並說明原因
      And photos 中仍只有 "p1"

      Examples:
        | 問題                            |
        | 不是 zip                        |
        | 缺少 manifest.json              |
        | manifest 的 app 不是 bloomin-photos |
        | manifest 的 schemaVersion 比 App 新 |
        | manifest 中有欄位缺漏的項目             |
        | manifest 中有 id 不是非空字串的項目       |
        | manifest 中有 recordDate 不是 YYYY-MM-DD 的項目 |
        | manifest 中有 width 或 height 不是正整數的項目 |
        | manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下 |

    # coverage: Error Handling / manifest 列出的照片檔缺失
    @error
    Scenario: 缺少圖檔的項目被略過（Error Handling）
      Given 一份 manifest 列出 "p1"、"p2"，但 zip 內只有 photos/p1.jpg 的照片備份
      When 老師匯入這份照片備份
      Then photos 新增 "p1"、不新增 "p2"
      And 回報略過 1 張檔案缺失

    # coverage: Error Handling / 匯入途中空間不足
    @error
    Scenario: 匯入途中空間不足時保留已匯入的部分（Error Handling）
      Given 一份含 "p1"、"p2"、"p3" 的照片備份 zip
      And 裝置儲存空間只夠再存 1 張
      When 老師匯入這份照片備份
      Then photos 中存在 "p1"
      And 回報已匯入 1 張、2 張因空間不足未匯入

    # coverage: Error Handling / 匯出時取消分享
    @error
    Scenario: 取消分享時不算備份完成（Error Handling）
      Given kv 的 photoBackupAt 為 "2026-09-01T00:00:00Z"
      When 老師匯出照片備份但在分享面板按取消
      Then kv 的 photoBackupAt 仍為 "2026-09-01T00:00:00Z"
      And 回報這次沒有備份照片

  Rule: 照片可刪除，但必須二次確認

    # coverage: State Transitions / 刪除需二次確認
    @state
    Scenario: 確認後刪除照片（State）
      Given photos 中存在 id 為 "p1" 的記錄
      When 老師要求刪除 "p1" 並在確認時同意
      Then photos 中不存在 "p1"

    # coverage: State Transitions / 取消刪除
    @state
    Scenario: 取消刪除時照片保留（State）
      Given photos 中存在 id 為 "p1" 的記錄
      When 老師要求刪除 "p1" 但在確認時取消
      Then photos 中仍存在 "p1"

    # coverage: State Transitions / 刪除後再匯入
    @state
    Scenario: 刪除後可從備份找回（State）
      Given 一份含 "p1" 的照片備份 zip
      And photos 中的 "p1" 已被刪除
      When 老師匯入這份照片備份
      Then photos 中存在 "p1"

  # coverage: State Transitions / IndexedDB v1 → v2 升級
  @state
  Scenario: 資料庫升級保留既有資料（State）
    Given 資料庫版本為 1，kv 中存有 state
    When App 以版本 2 開啟資料庫
    Then kv 中的 state 完整保留
    And photos 已建立且可依 studentId 查詢

  Rule: 與瀏覽器能力的串接失敗時要可預期

    # coverage: Integration Points / shareFile 匯出
    @integration
    Scenario: 照片備份透過分享面板送出（Integration）
      Given 裝置支援以分享面板送出檔案
      When 老師匯出照片備份
      Then zip 檔以分享面板送出，檔名以 "bloomin-照片備份-" 開頭並以 ".zip" 結尾

    # coverage: Integration Points / zip 編解碼
    @integration
    Scenario: 匯出的備份可被匯入還原（Integration）
      Given photos 中有 2 筆記錄
      When 老師匯出照片備份，清空 photos 後再匯入同一份
      Then photos 中的 2 筆記錄與匯出前完全相同，包含 blob 與 thumb 的內容

    # coverage: Integration Points / storageEstimate
    @integration
    Scenario: 顯示儲存空間用量（Integration）
      Given 瀏覽器可提供儲存空間估計
      When 老師開啟照片紀錄本
      Then 顯示目前用量與可用配額

    # coverage: Integration Points / storageEstimate 不可用
    @integration
    Scenario: 無法取得儲存空間時不顯示用量（Integration）
      Given 瀏覽器無法提供儲存空間估計
      When 老師開啟照片紀錄本
      Then 不顯示用量且不報錯

    # coverage: Integration Points / 圖片解碼與 canvas 像素上限
    @integration
    Scenario: 超大原圖仍能縮成上限尺寸（Integration）
      Given students 中存在 id 為 "s1" 的學生
      When 老師替學生 "s1" 新增一張 8000x6000 的照片
      Then 該記錄的 width 為 2000、height 為 1500

    # coverage: Integration Points / 離線可用
    @integration
    Scenario: 離線時照片功能完整可用（Integration）
      Given 裝置沒有網路連線
      When 老師新增、檢視、刪除照片或匯出匯入照片備份
      Then 所有操作皆正常完成
