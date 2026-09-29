import { vi } from 'vitest'

/**
 * 模擬瀏覽器以「交易中止」回報空間不足：寫入請求照常送出，接著交易被中止，
 * 未完成的請求收到 AbortError，交易的 error 才是 QuotaExceededError（Chrome 在 commit 時的回報方式）。
 *
 * 用 fake-indexeddb 內部的 `_abort(錯誤名稱)` 重現瀏覽器中止交易的行為，
 * 這是瀏覽器邊界的模擬，不碰 App 自己的程式。
 * allowWrites：前幾次寫入放行（模擬「只夠再存幾張」）。
 */
export function simulateTransactionAbort(errorName: string, allowWrites: number): void {
  const realPut = IDBObjectStore.prototype.put
  let writes = 0
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    const request = realPut.apply(this, args)
    if (writes++ >= allowWrites) {
      ;(this.transaction as unknown as { _abort(name: string): void })._abort(errorName)
    }
    return request
  })
}
