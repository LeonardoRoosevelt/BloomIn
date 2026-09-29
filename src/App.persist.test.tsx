import 'fake-indexeddb/auto'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import type { AppState } from './domain/types'
import { loadState } from './store/db'
import { flushPersist, useStore } from './store/useStore'

/** 瀏覽器寫入時發生錯誤（例如儲存區異常）；onWrite 可在失敗前模擬「同時又有新變更」。 */
function failWrites(onWrite: () => void = () => undefined) {
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    onWrite()
    throw new DOMException('Internal error writing to the database.', 'UnknownError')
  })
}

let unhandled: unknown[]
const onUnhandled = (reason: unknown) => unhandled.push(reason)

afterEach(() => {
  vi.restoreAllMocks()
  process.off('unhandledRejection', onUnhandled)
})

async function renderLoadedApp() {
  unhandled = []
  process.on('unhandledRejection', onUnhandled)
  render(<App />)
  await screen.findByRole('navigation', { name: '主導覽' })
}

describe('存檔失敗', () => {
  it('存檔失敗時保留變更並持續警告（Error Handling）', async () => {
    await renderLoadedApp()
    // 老師修改了資料；瀏覽器寫入 kv 時發生錯誤
    act(() => useStore.getState().updateSettings({ studioName: '小花美術教室' }))
    failWrites()

    // When App 存檔
    await act(() => flushPersist())

    // Then 顯示常駐警告，且沒有未處理的錯誤
    const warning = await screen.findByText(/資料沒有存進裝置：/)
    expect(warning.textContent).toContain('Internal error writing to the database.')
    expect(warning.textContent).toContain('請先匯出備份')
    expect(unhandled).toEqual([])

    // When 寫入恢復正常後 App 再次存檔
    vi.restoreAllMocks()
    await act(() => flushPersist())

    // Then 剛才的修改寫進裝置，警告消失
    expect((await loadState<AppState>())?.settings.studioName).toBe('小花美術教室')
    expect(screen.queryByText(/資料沒有存進裝置/)).toBeNull()
  })

  it('存檔失敗時保留變更並持續警告（Error Handling）：失敗期間又有新變更時保留較新的', async () => {
    await renderLoadedApp()
    act(() => useStore.getState().updateSettings({ studioName: '舊名稱' }))
    // 寫入進行中，老師又改了一次，然後這次寫入失敗
    failWrites(() => useStore.getState().updateSettings({ studioName: '新名稱' }))

    await act(() => flushPersist())
    vi.restoreAllMocks()
    await act(() => flushPersist())

    expect((await loadState<AppState>())?.settings.studioName).toBe('新名稱')
    expect(unhandled).toEqual([])
  })
})
