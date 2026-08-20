/**
 * 建立本機唯一識別碼。單機 App 不需要跨裝置協調，UUID v4 已足夠。
 *
 * crypto.randomUUID 只存在於安全情境（HTTPS 或 localhost）。用區網 IP 走
 * HTTP 測試時它是 undefined —— 少了這個備援，第一次啟動就會在建立種子資料時
 * 拋錯，整個畫面一片空白。getRandomValues 沒有這個限制。
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
