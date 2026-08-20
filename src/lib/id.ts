/** 建立本機唯一識別碼。單機 App 不需要跨裝置協調，randomUUID 已足夠。 */
export function newId(): string {
  return crypto.randomUUID()
}
