import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type Student } from '../domain/types'
import { getDb, PHOTO_BLOBS_STORE, PHOTOS_STORE } from '../store/db'
import { useStore } from '../store/useStore'
import { clearPhotoStores, photoRecord, seedPhotos } from '../test/photoFixtures'
import { PhotoBackupPanel } from './PhotoBackupPanel'

function student(id: string, name: string, archived = false): Student {
  return {
    id,
    name,
    phone: '',
    guardianName: '',
    guardianPhone: '',
    hourlyRateOverride: null,
    courseTypeIds: [],
    note: '',
    archived,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function setStudents(...students: Student[]) {
  useStore.setState({ data: { ...createInitialState(), students }, hydrated: true, hydrateError: null })
}

/** 模擬支援分享檔案的裝置；回傳被送進分享面板的檔案。 */
function stubShareSheet(outcome: 'share' | 'cancel' = 'share'): { shared: File[] } {
  const shared: File[] = []
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async ({ files }: { files: File[] }) => {
      if (outcome === 'cancel') throw new DOMException('Share canceled', 'AbortError')
      shared.push(...files)
    },
  })
  return { shared }
}

async function unzipFile(file: File) {
  return unzipSync(new Uint8Array(await file.arrayBuffer()))
}

async function kvGet(key: string): Promise<unknown> {
  return (await getDb()).get('kv', key)
}

/** 設定頁照片備份區裡某位學生（或未歸屬）的那一列。 */
function rowOf(label: string): HTMLElement {
  return screen.getByText(label).closest('li')!
}

beforeEach(async () => {
  await clearPhotoStores()
  const db = await getDb()
  for (const key of await db.getAllKeys('kv')) {
    if (String(key).startsWith('photoBackupAt')) await db.delete('kv', key)
  }
})

afterEach(() => {
  delete (navigator as { canShare?: unknown }).canShare
  delete (navigator as { share?: unknown }).share
})

describe('照片備份區', () => {
  it('照片備份區列出有照片的學生（Happy Path）', async () => {
    setStudents(student('s1', '王小明'), student('s2', '陳小美'), student('s3', '林大同'))
    await seedPhotos(
      photoRecord({ id: 'p1', studentId: 's1' }),
      photoRecord({ id: 'p2', studentId: 's1' }),
      photoRecord({ id: 'p3', studentId: 's2' }),
    )
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString()
    await (await getDb()).put('kv', threeDaysAgo, 'photoBackupAt:s2')

    render(<PhotoBackupPanel />)

    await screen.findByText('王小明')
    const ming = rowOf('王小明')
    expect(ming.textContent).toContain('2 張')
    expect(ming.textContent).toContain('從未備份')
    expect(within(ming).getByRole('button', { name: '匯出王小明的照片備份' })).toBeTruthy()
    const mei = rowOf('陳小美')
    expect(mei.textContent).toContain('1 張')
    expect(mei.textContent).toContain('3 天前')
    expect(within(mei).getByRole('button', { name: '匯出陳小美的照片備份' })).toBeTruthy()
    expect(screen.queryByText('林大同')).toBeNull()
  })

  it('匯出某位學生的照片備份（Happy Path）', async () => {
    setStudents(student('s1', '王小明'), student('s2', '陳小美'))
    await seedPhotos(
      photoRecord({ id: 'p1', studentId: 's1', caption: '簽到卡' }),
      photoRecord({ id: 'p2', studentId: 's1' }),
      photoRecord({ id: 'p3', studentId: 's2' }),
    )
    await (await getDb()).put('kv', '2026-09-01T00:00:00.000Z', 'photoBackupAt:s2')
    const { shared } = stubShareSheet()
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '匯出王小明的照片備份' }))
    await screen.findByText(/已送出照片備份/)

    expect(shared).toHaveLength(1)
    const entries = await unzipFile(shared[0]!)
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!)) as {
      app: string
      exportedAt: string
      scope: { kind: string; studentId: string }
      photos: { id: string; caption: string }[]
    }
    expect(manifest.app).toBe('bloomin-photos')
    expect(manifest.scope).toMatchObject({ kind: 'student', studentId: 's1' })
    expect(manifest.photos.map((x) => x.id).sort()).toEqual(['p1', 'p2'])
    expect(manifest.photos.find((x) => x.id === 'p1')!.caption).toBe('簽到卡')
    expect(strFromU8(entries['photos/p1.jpg']!)).toBe('BLOB-p1')
    expect(strFromU8(entries['photos/p2.jpg']!)).toBe('BLOB-p2')
    expect(Object.keys(entries).filter((k) => k.includes('p3'))).toEqual([])
    // 只更新這位學生的上次備份時間，而且就是這份備份的匯出時間
    expect(await kvGet('photoBackupAt:s1')).toBe(manifest.exportedAt)
    expect(await kvGet('photoBackupAt:s2')).toBe('2026-09-01T00:00:00.000Z')
  })

  it('學生照片備份透過分享面板送出（Integration）', async () => {
    setStudents(student('s1', '王小明'))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }))
    const { shared } = stubShareSheet()
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '匯出王小明的照片備份' }))
    await screen.findByText(/已送出照片備份/)

    const name = shared[0]!.name
    expect(name.startsWith('bloomin-照片備份-王小明-')).toBe(true)
    expect(name).toMatch(/-\d{8}-\d{4}\.zip$/)
  })

  it('取消分享時不算備份完成（Error Handling）', async () => {
    setStudents(student('s1', '王小明'))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }))
    await (await getDb()).put('kv', '2026-09-01T00:00:00.000Z', 'photoBackupAt:s1')
    stubShareSheet('cancel')
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '匯出王小明的照片備份' }))

    expect(await screen.findByText(/這次沒有備份照片/)).toBeTruthy()
    expect(await kvGet('photoBackupAt:s1')).toBe('2026-09-01T00:00:00.000Z')
  })

  it('沒有任何照片時照片備份區顯示空狀態（Edge Case）', async () => {
    setStudents(student('s1', '王小明'))
    render(<PhotoBackupPanel />)

    expect(await screen.findByText(/還沒有任何照片/)).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toEqual([])
    expect(screen.queryByText('王小明')).toBeNull()
  })

  it('照片備份處理中停用所有按鈕（Edge Case）', async () => {
    setStudents(student('s1', '王小明'), student('s2', '陳小美'))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }), photoRecord({ id: 'p2', studentId: 's2' }))
    // 分享面板開著不動，等於匯出還在進行中
    let finishShare!: () => void
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => new Promise<void>((resolve) => (finishShare = resolve)),
    })
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '匯出王小明的照片備份' }))

    await waitFor(() => expect(finishShare).toBeTypeOf('function'))
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true)

    finishShare()
    await screen.findByText(/已送出照片備份/)
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('未歸屬的照片可以單獨匯出（Happy Path）', async () => {
    setStudents(student('s1', '王小明'))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }), photoRecord({ id: 'p9', studentId: 's9' }))
    const { shared } = stubShareSheet()
    render(<PhotoBackupPanel />)

    await screen.findByText('未歸屬的照片')
    expect(rowOf('未歸屬的照片').textContent).toContain('1 張')
    fireEvent.click(screen.getByRole('button', { name: '匯出未歸屬的照片備份' }))
    await screen.findByText(/已送出照片備份/)

    const manifest = JSON.parse(strFromU8((await unzipFile(shared[0]!))['manifest.json']!)) as {
      exportedAt: string
      scope: { kind: string }
      photos: { id: string }[]
    }
    expect(manifest.scope).toEqual({ kind: 'unassigned' })
    expect(manifest.photos.map((x) => x.id)).toEqual(['p9'])
    expect(shared[0]!.name.startsWith('bloomin-照片備份-未歸屬-')).toBe(true)
    expect(await kvGet('photoBackupAt:unassigned')).toBe(manifest.exportedAt)
  })

  it('已封存學生的照片不算未歸屬（Edge Case）', async () => {
    setStudents(student('s1', '王小明', true))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }))

    render(<PhotoBackupPanel />)

    await screen.findByText('王小明')
    expect(rowOf('王小明').textContent).toContain('1 張')
    expect(screen.queryByText('未歸屬的照片')).toBeNull()
  })

  it('清除未歸屬的照片需二次確認（State）', async () => {
    setStudents(student('s1', '王小明'))
    await seedPhotos(photoRecord({ id: 'p1', studentId: 's1' }), photoRecord({ id: 'p9', studentId: 's9' }))
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '清除未歸屬的照片' }))
    expect(await screen.findByText(/無法復原/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '清除照片' }))

    await waitFor(() => expect(screen.queryByText('未歸屬的照片')).toBeNull())
    const db = await getDb()
    expect(await db.get(PHOTOS_STORE, 'p9')).toBeUndefined()
    expect(await db.get(PHOTO_BLOBS_STORE, 'p9')).toBeUndefined()
    expect(await db.get(PHOTOS_STORE, 'p1')).toBeDefined()
    expect(await db.get(PHOTO_BLOBS_STORE, 'p1')).toBeDefined()
  })

  it('取消清除未歸屬的照片時照片保留（State）', async () => {
    setStudents(student('s1', '王小明'))
    await seedPhotos(photoRecord({ id: 'p9', studentId: 's9' }))
    render(<PhotoBackupPanel />)

    fireEvent.click(await screen.findByRole('button', { name: '清除未歸屬的照片' }))
    await screen.findByText(/無法復原/)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: '清除照片' })).toBeNull())
    expect(await (await getDb()).get(PHOTOS_STORE, 'p9')).toBeDefined()
    expect(rowOf('未歸屬的照片').textContent).toContain('1 張')
  })
})
