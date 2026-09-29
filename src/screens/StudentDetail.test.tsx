import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../domain/types'
import { useStore } from '../store/useStore'
import { StudentDetail } from './StudentDetail'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('學生詳情頁的照片紀錄本入口', () => {
  it('照片張數取不到時入口不顯示張數（Error Handling）', async () => {
    const seen: unknown[] = []
    const onUnhandled = (reason: unknown) => seen.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      useStore.setState({
        data: {
          ...createInitialState(),
          students: [
            {
              id: 's1',
              name: '王小明',
              phone: '',
              guardianName: '',
              guardianPhone: '',
              hourlyRateOverride: null,
              courseTypeIds: [],
              note: '',
              archived: false,
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
        hydrated: true,
        hydrateError: null,
      })
      // 瀏覽器計算照片張數時發生錯誤
      vi.spyOn(IDBIndex.prototype, 'count').mockImplementation(() => {
        throw new DOMException('Internal error.', 'UnknownError')
      })

      render(<StudentDetail studentId="s1" />)
      const entry = await screen.findByRole('button', { name: /照片紀錄本/ })
      await new Promise((r) => setTimeout(r, 20))

      expect(entry.textContent).not.toMatch(/\d+ 張/)
      expect(seen).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})
