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
      And photos 中的記錄只含中繼資料與 thumb，原圖存於 photoBlobs（key 同該記錄的 id）

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
      And 列表只讀取 photos 的 thumb，不讀取 photoBlobs 的原圖

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
      And photoBlobs 中也只有 "p1" 的原圖

    # coverage: Error Handling / 空間不足以交易中止的形式回報
    @error
    Scenario: 空間不足以交易中止回報時同樣視為空間不足（Error Handling）
      Given photos 中存在 id 為 "p1" 的記錄
      And 裝置儲存空間已滿，瀏覽器以交易中止回報（請求錯誤為 AbortError、交易錯誤為 QuotaExceededError）
      When 老師替學生 "s1" 新增一張照片，或匯入一份含 "p2"、"p3" 的照片備份
      Then 回報「裝置儲存空間不足」並停止
      And photos 中仍只有 "p1"

    # coverage: Error Handling / 其他原因的交易中止
    @error
    Scenario: 非空間不足的交易中止不會被誤報為空間不足（Error Handling）
      Given 瀏覽器寫入時交易因其他原因中止（交易錯誤不是 QuotaExceededError）
      When 老師替學生 "s1" 新增一張照片
      Then 不回報「裝置儲存空間不足」，錯誤照常呈現

    # coverage: Error Handling / 學生 id 不存在
    @error
    Scenario: 學生不存在時顯示找不到（Error Handling）
      Given students 中不存在 id 為 "ghost" 的學生
      When 老師開啟學生 "ghost" 的照片紀錄本
      Then 顯示「找不到這位學生」

    # coverage: Error Handling / 一般資料存檔失敗（不限照片功能）
    @error
    Scenario: 存檔失敗時保留變更並持續警告（Error Handling）
      Given App 已載入，老師修改了資料
      And 瀏覽器寫入 kv 時發生錯誤
      When App 存檔
      Then 顯示常駐警告「資料沒有存進裝置：<原因>。請先匯出備份。」
      And 沒有未處理的錯誤
      When 寫入恢復正常後 App 再次存檔
      Then 剛才的修改寫進裝置，警告消失

    # coverage: Error Handling / 存檔失敗與新的存檔交錯
    @error
    Scenario: 存檔失敗不會讓較舊的資料覆蓋較新的資料（Error Handling）
      Given App 正在存檔修改 S1，這次寫入稍後會失敗
      And 老師接著改成 S2，App 再次存檔
      When S1 的寫入失敗後，App 又存檔一次
      Then 裝置上的資料是 S2，不會被 S1 覆蓋
      And S1 失敗的警告直到 S2 真正存入才消失

    # coverage: Error Handling / 還原時寫入裝置失敗
    @error
    Scenario: 還原時存檔失敗不會顯示已還原（Error Handling）
      Given 設定頁的資料備份區
      And 瀏覽器寫入 kv 的 state 時發生錯誤
      When 老師還原一份 JSON 資料備份，或按「復原到匯入之前」
      Then 顯示「還原的資料沒有存進裝置：<原因>。」
      And 不顯示「已還原」或「已復原」

    # coverage: Error Handling / 編輯或刪除時寫入失敗
    @error
    Scenario: 編輯或刪除失敗時顯示錯誤（Error Handling）
      Given photos 中存在 id 為 "p1"、caption 為 "原本的說明" 的記錄
      And 瀏覽器寫入 photos 時發生錯誤
      When 老師在檢視 "p1" 時修改說明並儲存，或確認刪除 "p1"
      Then 顯示「無法儲存修改」或「無法刪除照片」的錯誤訊息
      And 檢視器保持開著，"p1" 的 caption 仍為 "原本的說明"
      And 沒有未處理的錯誤

    # coverage: Error Handling / 照片張數取不到
    @error
    Scenario: 照片張數取不到時入口不顯示張數（Error Handling）
      Given students 中存在 id 為 "s1" 的學生
      And 瀏覽器計算照片張數時發生錯誤
      When 老師開啟學生 "s1" 的詳情頁
      Then 顯示「照片紀錄本」入口但不帶張數
      And 沒有未處理的錯誤

    # coverage: Error Handling / 讀取照片失敗
    @error
    Scenario: 讀取照片失敗時顯示錯誤（Error Handling）
      Given students 中存在 id 為 "s1" 的學生
      And 瀏覽器讀取 photos 時發生錯誤
      When 老師開啟學生 "s1" 的照片紀錄本
      Then 顯示「無法讀取照片」的錯誤訊息
      And 不顯示「還沒有照片」的空狀態

  Rule: 照片備份是獨立的 zip，匯入只做合併且絕不覆蓋

    # coverage: Happy Path / 逐位學生匯出照片備份
    @happy-path
    Scenario: 照片備份區列出有照片的學生（Happy Path）
      Given students 中有 "王小明"（s1）、"陳小美"（s2）、"林大同"（s3）
      And photos 中 s1 有 2 張、s2 有 1 張、s3 沒有照片
      And kv 的 photoBackupAt:s2 為 3 天前
      When 老師開啟設定頁的照片備份區
      Then 列出 "王小明 2 張 從未備份" 與 "陳小美 1 張 3 天前"，每列都有匯出按鈕
      And 不列出 "林大同"

    # coverage: Happy Path / 逐位學生匯出照片備份
    @happy-path
    Scenario: 匯出某位學生的照片備份（Happy Path）
      Given photos 中 s1 有 "p1"、"p2"，s2 有 "p3"
      When 老師在照片備份區匯出 "王小明" 的照片備份
      Then 產生的 zip 含 manifest.json，其 app 為 "bloomin-photos"、scope 為學生 s1，且只列出 "p1"、"p2" 的中繼資料
      And zip 含 photos/p1.jpg 與 photos/p2.jpg，不含 "p3" 的圖檔
      And kv 的 photoBackupAt:s1 更新為匯出時間，photoBackupAt:s2 不變

    # coverage: Happy Path / 照片備份區的未歸屬照片
    @happy-path
    Scenario: 未歸屬的照片可以單獨匯出（Happy Path）
      Given students 中有 "王小明"（s1），沒有 s9
      And photos 中 s1 有 "p1"，s9 有 "p9"
      When 老師在照片備份區匯出「未歸屬的照片」
      Then 照片備份區有一列 "未歸屬的照片 1 張"
      And 產生的 zip 的 scope 為未歸屬，只列出 "p9"，檔名以 "bloomin-照片備份-未歸屬-" 開頭
      And kv 的 photoBackupAt:unassigned 更新為匯出時間

    # coverage: Happy Path / 照片備份區的未歸屬照片
    @edge-case
    Scenario: 已封存學生的照片不算未歸屬（Edge Case）
      Given students 中 "王小明"（s1）已封存，且 s1 有照片
      When 老師開啟設定頁的照片備份區
      Then "王小明" 照常列出
      And 不顯示「未歸屬的照片」這一列

    # coverage: Happy Path / 逐位學生匯出照片備份
    @edge-case
    Scenario: 沒有任何照片時照片備份區顯示空狀態（Edge Case）
      Given photos 為空
      When 老師開啟設定頁的照片備份區
      Then 顯示還沒有照片的簡短說明，不列出任何學生

    # coverage: Happy Path / 逐位學生匯出照片備份
    @edge-case
    Scenario: 照片備份處理中停用所有按鈕（Edge Case）
      Given photos 中 s1、s2 各有照片
      When 老師匯出 "王小明" 的照片備份，打包還在進行中
      Then 照片備份區的所有匯出與匯入按鈕都停用

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
        | manifest 中有 recordDate 不是實際存在日期的項目 |
        | manifest 中有 createdAt 不是 ISO 8601 的項目 |
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
      Given kv 的 photoBackupAt:s1 為 "2026-09-01T00:00:00.000Z"
      When 老師匯出 "王小明" 的照片備份但在分享面板按取消
      Then kv 的 photoBackupAt:s1 仍為 "2026-09-01T00:00:00.000Z"
      And 回報這次沒有備份照片

  Rule: 照片可刪除，但必須二次確認

    # coverage: State Transitions / 清除未歸屬的照片
    @state
    Scenario: 清除未歸屬的照片需二次確認（State）
      Given photos 中 s1 有 "p1"，不在學生資料中的 s9 有 "p9"
      When 老師在照片備份區按「清除」未歸屬的照片並在確認時同意
      Then photos 與 photoBlobs 中都不存在 "p9"
      And "p1" 仍在
      And 不再顯示「未歸屬的照片」這一列

    # coverage: State Transitions / 清除未歸屬的照片
    @state
    Scenario: 取消清除未歸屬的照片時照片保留（State）
      Given photos 中不在學生資料中的 s9 有 "p9"
      When 老師在照片備份區按「清除」未歸屬的照片但在確認時取消
      Then photos 中仍存在 "p9"

    # coverage: State Transitions / 刪除需二次確認
    @state
    Scenario: 確認後刪除照片（State）
      Given photos 中存在 id 為 "p1" 的記錄
      When 老師要求刪除 "p1" 並在確認時同意
      Then photos 中不存在 "p1"
      And photoBlobs 中也不存在 "p1" 的原圖

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
    And photoBlobs 已建立，可依照片 id 存取原圖

  # coverage: State Transitions / 升級時舊版分頁仍開著
  @state
  Scenario: 舊版分頁未關閉時升級不會卡住（State）
    Given 資料庫版本為 1，kv 中存有 state
    And 另一個舊版分頁仍開著版本 1 的連線
    When App 以版本 2 開啟資料庫
    Then 顯示「請關閉其他開著的 BloomIn 分頁」的提示，而不是空白畫面
    When 舊版分頁關閉連線
    Then 升級完成並進入 App，kv 中的 state 完整保留

  # coverage: State Transitions / 更新版本開啟時讓出連線
  @state
  Scenario: 本分頁不會擋住較新版本的升級（State）
    Given App 以版本 2 開著資料庫
    When 另一個分頁以版本 3 開啟資料庫
    Then 版本 3 的開啟不會被本分頁擋住

  # coverage: State Transitions / 讓出連線時仍有未寫入的變更
  @state
  Scenario: 被較新版本取代後不會靜默遺失輸入（State）
    Given App 以版本 2 開著資料庫，且有一筆剛修改、尚未寫入的資料
    When 另一個分頁以版本 3 開啟資料庫
    Then 版本 3 中讀得到剛才的修改
    And 顯示「BloomIn 已在其他分頁更新，請重新開啟 App」並提供重新載入，擋住所有輸入
    And 之後不再嘗試寫入，也沒有未處理的錯誤

  Rule: 與瀏覽器能力的串接失敗時要可預期

    # coverage: Integration Points / shareFile 匯出某位學生的照片備份
    @integration
    Scenario: 學生照片備份透過分享面板送出（Integration）
      Given 裝置支援以分享面板送出檔案
      When 老師匯出 "王小明" 的照片備份
      Then zip 檔以分享面板送出，檔名以 "bloomin-照片備份-王小明-" 開頭並以 ".zip" 結尾

    # coverage: Integration Points / shareFile 匯出某位學生的照片備份
    @edge-case
    Scenario: 學生姓名含檔名不允許的字元時仍能匯出（Edge Case）
      Given 學生姓名為 'A/B\C:D*E?F"G<H>I|J'
      When 產生該學生的照片備份檔名
      Then 檔名不含 / \ : * ? " < > | 任何一個字元，且仍以 "bloomin-照片備份-" 開頭、".zip" 結尾

    # coverage: Integration Points / zip 編解碼
    @integration
    Scenario: 匯出的學生照片備份可被匯入還原（Integration）
      Given photos 中 s1 有 2 筆記錄
      When 老師匯出 "王小明" 的照片備份，清空照片後再匯入同一份
      Then photos 中的 2 筆記錄與匯出前完全相同，包含原圖與 thumb 的內容

    # coverage: Integration Points / 匯入舊版的全部照片備份
    @integration
    Scenario: 舊版的全部照片備份仍可匯入（Integration）
      Given 一份沒有 scope 欄位、含 s1 的 "p1" 與 s2 的 "p2" 的照片備份 zip（逐學生匯出之前的格式）
      When 老師匯入這份照片備份
      Then photos 中存在 "p1"、"p2"，各自屬於原本的學生

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
