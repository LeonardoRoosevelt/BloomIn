import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../domain/types'
import { useStore } from '../store/useStore'
import { BackupBanner } from './BackupBanner'

describe('備份提醒橫幅', () => {
  it('備份提醒說明照片需另外備份（Happy Path）', () => {
    // Given students 中有學生，且從未備份資料
    const data = createInitialState()
    data.students.push({
      id: 's1',
      name: '王小明',
      phone: '',
      guardianName: '',
      guardianPhone: '',
      hourlyRateOverride: null,
      courseTypeIds: [],
      note: '',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    useStore.setState({ data, hydrated: true, hydrateError: null })

    render(<BackupBanner />)

    const banner = screen.getByRole('button', { name: /尚未備份過資料/ })
    expect(banner.textContent).toContain('照片需另外在設定頁逐位學生備份')
  })
})
