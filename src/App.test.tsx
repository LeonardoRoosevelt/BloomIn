import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { createInitialState } from './domain/types'
import { useStore } from './store/useStore'

describe('資料庫升級', () => {
  it('舊版分頁未關閉時升級不會卡住（State）', async () => {
    // Given 資料庫版本為 1，kv 中存有 state
    const legacy = createInitialState()
    legacy.students.push({
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
    })
    // And 另一個舊版分頁仍開著版本 1 的連線（舊版程式沒有處理 versionchange，不會自己關）
    const oldTab = await openDB('bloomin', 1, {
      upgrade(db) {
        db.createObjectStore('kv')
      },
    })
    await oldTab.put('kv', legacy, 'state')

    // When App 以版本 2 開啟資料庫
    render(<App />)

    // Then 顯示提示，而不是空白畫面
    expect(await screen.findByText(/請關閉其他開著的 BloomIn 分頁/)).toBeTruthy()

    // When 舊版分頁關閉連線
    oldTab.close()

    // Then 升級完成並進入 App，kv 中的 state 完整保留
    expect(await screen.findByRole('navigation', { name: '主導覽' })).toBeTruthy()
    expect(useStore.getState().hydrateError).toBeNull()
    expect(useStore.getState().data).toEqual(legacy)
  })
})
