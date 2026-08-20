/**
 * CSV 產生。
 *
 * 逃逸處理錯了不會報錯，只會讓欄位默默錯位 —— 一個名字裡有逗號的學生，
 * 就足以讓整份報表往後偏一格而看不出來。
 */

/** RFC 4180：含分隔符、引號或換行的欄位要用雙引號包住，內部引號成對重複。 */
function escapeCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(escapeCell).join(','))
  // CRLF 是 RFC 4180 的行尾，Excel 對它最沒有意見
  return lines.join('\r\n')
}

/**
 * 產生可供 Excel / Numbers 直接開啟的 CSV 檔。
 *
 * 開頭的 UTF-8 BOM 不可省略：少了它，Excel 會用系統預設編碼解讀，
 * 中文全部變成亂碼。
 */
export function csvFile(name: string, content: string): File {
  // 寫成跳脫序列而非直接貼上 U+FEFF：不可見字元很容易被編輯器或工具悄悄吃掉
  return new File(['\uFEFF', content], name, { type: 'text/csv;charset=utf-8' })
}
