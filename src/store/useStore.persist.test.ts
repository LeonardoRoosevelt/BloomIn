import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '../domain/types'

/*
 * 存檔寫入換成可控制的假 saveState（IndexedDB 寫入的邊界）：
 * 第一次寫入延遲 100ms 後失敗，之後的寫入都成功，並記下「裝置上」目前的資料。
 */
const device = vi.hoisted(() => ({
  attempts: 0,
  saved: null as string | null,
  successfulWrites: [] as string[],
}))

vi.doMock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>()
  return {
    ...actual,
    saveState: async (state: AppState) => {
      device.attempts++
      if (device.attempts === 1) {
        await new Promise((r) => setTimeout(r, 100))
        throw new Error('寫入失敗')
      }
      device.saved = state.settings.studioName
      device.successfulWrites.push(state.settings.studioName)
    },
  }
})

const { flushPersist, useStore } = await import('./useStore')

describe('存檔串行化', () => {
  it('存檔失敗不會讓較舊的資料覆蓋較新的資料（Error Handling）', async () => {
    // Given App 正在存檔修改 S1，這次寫入稍後會失敗
    useStore.getState().updateSettings({ studioName: 'S1' })
    const firstFlush = flushPersist()
    // And 老師接著改成 S2，App 再次存檔
    useStore.getState().updateSettings({ studioName: 'S2' })
    const secondFlush = flushPersist()

    // When S1 的寫入失敗後，App 又存檔一次（例如切到背景）
    await firstFlush
    await secondFlush
    await flushPersist()

    // Then 裝置上的資料是 S2，不會被 S1 覆蓋
    expect(device.saved).toBe('S2')
    expect(device.successfulWrites).toEqual(['S2'])
    expect(useStore.getState().data.settings.studioName).toBe('S2')
    // And 最新狀態已真正存入，警告才消失
    expect(useStore.getState().persistError).toBeNull()
  })
})
