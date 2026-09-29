import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState, type Student } from '../domain/types'
import { getDb, PHOTOS_STORE } from '../store/db'
import { useStore } from '../store/useStore'
import { StudentPhotos } from './StudentPhotos'
import { photoRecord, seedPhotos } from '../test/photoFixtures'
import { fakeImageFile } from '../test/fakeCodec'
import { getPhoto, listAllPhotos } from '../store/photos'

/*
 * 瀏覽器的圖片解碼／編碼換成假 codec；gate 可讓解碼停住，模擬 iPhone 上處理大圖的那幾秒。
 */
const codec = vi.hoisted(() => ({ gate: null as Promise<void> | null, decodes: 0 }))
vi.mock('../lib/imageCodec', async () => {
  const { fakeCodec } = await import('../test/fakeCodec')
  return {
    browserCodec: {
      ...fakeCodec,
      decode: async (file: Blob) => {
        codec.decodes++
        if (codec.gate) await codec.gate
        return fakeCodec.decode(file)
      },
    },
  }
})

function pickFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files } })
}

function student(fields: Partial<Student> & { id: string }): Student {
  return {
    name: '小明',
    phone: '',
    guardianName: '',
    guardianPhone: '',
    hourlyRateOverride: null,
    courseTypeIds: [],
    note: '',
    archived: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...fields,
  }
}

/** jsdom 沒有 object URL；記下每個 URL 對應的 Blob，測試才能分辨畫面顯示的是哪個檔案。 */
let objectUrls: Map<string, Blob>
let revokedUrls: Set<string>

beforeEach(async () => {
  codec.gate = null
  codec.decodes = 0
  objectUrls = new Map()
  revokedUrls = new Set()
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${objectUrls.size + 1}`
    objectUrls.set(url, blob)
    return url
  }
  URL.revokeObjectURL = (url: string) => {
    revokedUrls.add(url)
  }
  const db = await getDb()
  await db.clear(PHOTOS_STORE)
  // Given：students 中存在 s1
  useStore.setState({
    data: { ...createInitialState(), students: [student({ id: 's1', name: '王小明' })] },
    hydrated: true,
    hydrateError: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (navigator as { storage?: unknown }).storage
})

/** 模擬瀏覽器的 navigator.storage.estimate()。 */
function stubStorageEstimate(estimate: () => Promise<{ usage: number; quota: number }>) {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate } })
}

describe('照片紀錄本畫面', () => {
  it('沒有照片時顯示空狀態（Edge Case）', async () => {
    render(<StudentPhotos studentId="s1" />)

    expect(await screen.findByText('還沒有照片')).toBeTruthy()
    expect(screen.getByRole('button', { name: '新增照片' })).toBeTruthy()
  })

  it('學生不存在時顯示找不到（Error Handling）', async () => {
    render(<StudentPhotos studentId="ghost" />)

    expect(await screen.findByText('找不到這位學生')).toBeTruthy()
  })

  it('讀取照片失敗時顯示錯誤（Error Handling）', async () => {
    // 瀏覽器讀取 photos 時發生錯誤（IndexedDB 的外部邊界）
    vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(() => {
      throw new DOMException('Internal error reading the database.', 'UnknownError')
    })

    render(<StudentPhotos studentId="s1" />)

    expect(await screen.findByText(/無法讀取照片/)).toBeTruthy()
    expect(screen.queryByText('還沒有照片')).toBeNull()
  })

  it('檢視照片原尺寸（Happy Path）', async () => {
    await seedPhotos(
      photoRecord({ id: 'p1', width: 2000, recordDate: '2024-03-15', caption: '上學期簽到卡 第 1 頁' }),
    )
    render(<StudentPhotos studentId="s1" />)

    fireEvent.click(await screen.findByRole('button', { name: /開啟.*照片/ }))

    const viewer = await screen.findByRole('dialog', { name: '檢視照片' })
    const img = await within(viewer).findByRole('img')
    const shown = objectUrls.get(img.getAttribute('src')!)
    expect(await shown!.text()).toBe('BLOB-p1')
    expect(viewer.textContent).toContain('2024 年 3 月 15 日')
    expect(viewer.textContent).toContain('上學期簽到卡 第 1 頁')
  })

  it('儲存處理中不會重複寫入（Edge Case）', async () => {
    let release!: () => void
    codec.gate = new Promise((r) => (release = r))
    render(<StudentPhotos studentId="s1" />)
    await screen.findByText('還沒有照片')

    // 老師正在替學生 s1 新增一張照片
    pickFiles([fakeImageFile(4000, 3000)])
    const save = await screen.findByRole('button', { name: '儲存' })

    // 儲存處理中（解碼還沒完成）再次按下儲存
    fireEvent.click(save)
    fireEvent.click(save)
    release()

    expect(await screen.findByText(/已新增 1 張/)).toBeTruthy()
    await waitFor(async () => expect(await listAllPhotos()).toHaveLength(1))
    expect(codec.decodes).toBe(1)
  })

  it('顯示儲存空間用量（Integration）', async () => {
    stubStorageEstimate(async () => ({ usage: 150 * 1024 * 1024, quota: 2048 * 1024 * 1024 }))

    render(<StudentPhotos studentId="s1" />)

    const usage = await screen.findByText(/已使用/)
    expect(usage.textContent).toContain('150 MB')
    expect(usage.textContent).toContain('2,048 MB')
  })

  it('無法取得儲存空間時不顯示用量（Integration）', async () => {
    // 例如私密瀏覽或權限受限時，estimate() 直接失敗
    stubStorageEstimate(async () => {
      throw new DOMException('Storage estimate is not available', 'SecurityError')
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      render(<StudentPhotos studentId="s1" />)
      await screen.findByText('還沒有照片')
      await new Promise((r) => setTimeout(r, 20))

      expect(screen.queryByText(/已使用/)).toBeNull()
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('確認後刪除照片（State）', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))
    render(<StudentPhotos studentId="s1" />)
    fireEvent.click(await screen.findByRole('button', { name: /開啟.*照片/ }))
    const viewer = await screen.findByRole('dialog', { name: '檢視照片' })

    // 老師要求刪除 p1，確認時說明無法復原，老師同意
    fireEvent.click(within(viewer).getByRole('button', { name: '刪除' }))
    expect(await screen.findByText(/刪除後無法復原/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '刪除照片' }))

    await waitFor(async () => expect(await getPhoto('p1')).toBeUndefined())
    // 列表立即更新
    expect(await screen.findByText('還沒有照片')).toBeTruthy()
  })

  it('取消刪除時照片保留（State）', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))
    render(<StudentPhotos studentId="s1" />)
    fireEvent.click(await screen.findByRole('button', { name: /開啟.*照片/ }))
    const viewer = await screen.findByRole('dialog', { name: '檢視照片' })

    // 老師要求刪除 p1，但在確認時取消
    fireEvent.click(within(viewer).getByRole('button', { name: '刪除' }))
    await screen.findByText(/刪除後無法復原/)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: '刪除照片' })).toBeNull())
    expect(await getPhoto('p1')).toBeDefined()
    // 照片仍在檢視中，沒有被關掉
    expect(screen.getByRole('dialog', { name: '檢視照片' })).toBeTruthy()
  })

  /** 收集測試期間的未處理 rejection；回傳停止收集並取得結果的函式。 */
  function collectUnhandled(): () => unknown[] {
    const seen: unknown[] = []
    const on = (reason: unknown) => seen.push(reason)
    process.on('unhandledRejection', on)
    return () => {
      process.off('unhandledRejection', on)
      return seen
    }
  }

  async function openViewerOfP1() {
    await seedPhotos(photoRecord({ id: 'p1', caption: '原本的說明' }))
    render(<StudentPhotos studentId="s1" />)
    fireEvent.click(await screen.findByRole('button', { name: /開啟.*照片/ }))
    const viewer = await screen.findByRole('dialog', { name: '檢視照片' })
    await within(viewer).findByText('原本的說明')
    return viewer
  }

  it('編輯或刪除失敗時顯示錯誤（Error Handling）：編輯', async () => {
    const stop = collectUnhandled()
    const viewer = await openViewerOfP1()
    fireEvent.click(within(viewer).getByRole('button', { name: '編輯' }))
    fireEvent.change(await screen.findByDisplayValue('原本的說明'), { target: { value: '改過的說明' } })
    // 瀏覽器寫入 photos 時發生錯誤
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Internal error.', 'UnknownError')
    })

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText(/無法儲存修改/)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 20))
    vi.restoreAllMocks()
    expect(screen.getByRole('dialog', { name: '檢視照片' })).toBeTruthy()
    expect((await getPhoto('p1'))!.caption).toBe('原本的說明')
    expect(stop()).toEqual([])
  })

  it('編輯或刪除失敗時顯示錯誤（Error Handling）：刪除', async () => {
    const stop = collectUnhandled()
    const viewer = await openViewerOfP1()
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new DOMException('Internal error.', 'UnknownError')
    })

    fireEvent.click(within(viewer).getByRole('button', { name: '刪除' }))
    fireEvent.click(await screen.findByRole('button', { name: '刪除照片' }))

    expect(await screen.findByText(/無法刪除照片/)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 20))
    vi.restoreAllMocks()
    expect(screen.getByRole('dialog', { name: '檢視照片' })).toBeTruthy()
    expect(await getPhoto('p1')).toBeDefined()
    expect(stop()).toEqual([])
  })
})
