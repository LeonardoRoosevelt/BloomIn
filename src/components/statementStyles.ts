/**
 * 月結單樣式。
 *
 * 刻意寫成獨立字串而不是 CSS module：
 * 1. 列印稿與 App 主題無關 —— 一律 A4、黑字白底，不該跟著深色模式變。
 * 2. 備援路徑（在新分頁開啟後列印）需要把樣式一起帶過去，字串是唯一
 *    能同時餵給頁內 <style> 與新視窗的形式，避免兩份樣式各自漂移。
 */
export const STATEMENT_CSS = `
.statement-sheet {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Noto Sans TC', sans-serif;
  color: #000;
  background: #fff;
  line-height: 1.5;
}
.statement {
  padding: 14mm;
  box-sizing: border-box;
}
.statement + .statement {
  border-top: 1px dashed #bbb;
}
.st-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 2px solid #000;
  padding-bottom: 6pt;
  margin-bottom: 12pt;
}
.st-studio { font-size: 15pt; font-weight: 700; }
.st-teacher { font-size: 9pt; color: #444; margin-top: 2pt; }
.st-title { font-size: 12pt; font-weight: 600; text-align: right; }
.st-period { font-size: 9pt; color: #444; margin-top: 2pt; }
.st-who {
  display: flex;
  gap: 18pt;
  align-items: baseline;
  margin-bottom: 10pt;
  font-size: 11pt;
}
.st-name { font-size: 14pt; font-weight: 600; }
.st-phone { font-size: 9pt; color: #444; }
table.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  /* 固定欄寬：全班列印時每一頁的表格結構要一致，
     否則同一份文件的不同頁看起來像兩種格式。 */
  table-layout: fixed;
}
.st-table th {
  text-align: left;
  border-bottom: 1px solid #000;
  padding: 4pt 3pt;
  font-weight: 600;
  white-space: nowrap;
}
.st-table td {
  border-bottom: 1px solid #ddd;
  padding: 4pt 3pt;
  vertical-align: top;
}
.st-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.st-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.st-topic { color: #333; }
.st-muted { color: #777; }
.st-total {
  display: flex;
  justify-content: flex-end;
  gap: 18pt;
  align-items: baseline;
  margin-top: 10pt;
  padding-top: 8pt;
  border-top: 2px solid #000;
}
.st-total-label { font-size: 10pt; }
.st-total-value { font-size: 15pt; font-weight: 700; font-variant-numeric: tabular-nums; }
.st-foot {
  margin-top: 14pt;
  font-size: 8pt;
  color: #666;
  display: flex;
  justify-content: space-between;
}
.st-empty { font-size: 10pt; color: #666; padding: 12pt 0; }

@media print {
  @page { size: A4; margin: 0; }
  .statement {
    page-break-after: always;
    /* 最後一頁不要再多送一張空白紙 */
  }
  .statement:last-child { page-break-after: auto; }
  .statement + .statement { border-top: none; }
  .st-table tr { page-break-inside: avoid; }
}
`
