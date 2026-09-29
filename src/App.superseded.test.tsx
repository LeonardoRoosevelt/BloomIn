import 'fake-indexeddb/auto'
import { act, render, screen } from '@testing-library/react'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { AppState } from './domain/types'
import { useStore } from './store/useStore'

describe('資料庫被較新版本取代', () => {
  it('被較新版本取代後不會靜默遺失輸入（State）', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      // Given App 以版本 2 開著資料庫
      render(<App />)
      await screen.findByRole('navigation', { name: '主導覽' })
      // 且有一筆剛修改、尚未寫入的資料（仍在 300ms 存檔延遲內）
      act(() => useStore.getState().updateSettings({ studioName: '小花美術教室' }))

      // When 另一個分頁以版本 3 開啟資料庫
      const newer = await openDB('bloomin', 3)

      // Then 版本 3 中讀得到剛才的修改
      const saved = (await newer.get('kv', 'state')) as AppState | undefined
      expect(saved?.settings.studioName).toBe('小花美術教室')
      newer.close()

      // And 顯示提示並提供重新載入，擋住所有輸入（主畫面整個被取代）
      expect(await screen.findByText(/BloomIn 已在其他分頁更新，請重新開啟 App/)).toBeTruthy()
      expect(screen.getByRole('button', { name: '重新載入' })).toBeTruthy()
      expect(screen.queryByRole('navigation', { name: '主導覽' })).toBeNull()

      // And 之後不再嘗試寫入，也沒有未處理的錯誤（再有變更也只是被丟棄，等過存檔延遲）
      act(() => useStore.getState().updateSettings({ studioName: '不該存進去' }))
      await new Promise((r) => setTimeout(r, 400))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})
