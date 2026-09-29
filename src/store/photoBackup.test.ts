import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, loadPhotoBackupAt, PHOTOS_STORE, savePhotoBackupAt } from './db'
import { describeExport, describeImport, exportPhotoBackup, importPhotoBackup } from './photoBackup'
import { deletePhoto, getPhoto, listAllPhotos } from './photos'
import { photoRecord, seedPhotos } from '../test/photoFixtures'

const NOW = new Date('2026-09-29T14:05:00+08:00')

beforeEach(async () => {
  const db = await getDb()
  await db.clear(PHOTOS_STORE)
  await db.delete('kv', 'photoBackupAt')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 模擬支援分享檔案的裝置；回傳被送進分享面板的檔案。 */
function stubShareSheet(outcome: 'share' | 'cancel' = 'share'): { shared: File[] } {
  const shared: File[] = []
  vi.stubGlobal('navigator', {
    canShare: () => true,
    share: async ({ files }: { files: File[] }) => {
      if (outcome === 'cancel') throw new DOMException('Share canceled', 'AbortError')
      shared.push(...files)
    },
  })
  return { shared }
}

/**
 * 依照片備份格式手工組一份 zip（不經過匯出程式，當作獨立的 Given）。
 * omitFiles 列出的 id 只出現在 manifest，zip 內沒有圖檔。
 */
function backupZip(
  photos: ReturnType<typeof photoRecord>[],
  options: { omitFiles: string[]; manifest: Record<string, unknown> } = { omitFiles: [], manifest: {} },
): Promise<File> {
  return (async () => {
    const files: Zippable = {}
    const entries = []
    for (const p of photos) {
      const { blob, thumb, ...meta } = p
      const file = `photos/${p.id}.jpg`
      const thumbFile = `thumbs/${p.id}.jpg`
      if (!options.omitFiles.includes(p.id)) {
        files[file] = new Uint8Array(await blob.arrayBuffer())
        files[thumbFile] = new Uint8Array(await thumb.arrayBuffer())
      }
      entries.push({ ...meta, file, thumbFile })
    }
    const manifest = {
      app: 'bloomin-photos',
      schemaVersion: 1,
      exportedAt: '2026-09-28T00:00:00.000Z',
      photos: entries,
      ...options.manifest,
    }
    files['manifest.json'] = strToU8(JSON.stringify(manifest))
    return new File([zipSync(files, { level: 0 })], 'backup.zip', { type: 'application/zip' })
  })()
}

/** 所有照片的完整內容（含 blob / thumb 的位元組），依 id 排序以便比對。 */
async function snapshot() {
  const photos = await listAllPhotos()
  return Promise.all(
    photos
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(async ({ blob, thumb, ...meta }) => ({
        ...meta,
        blob: { type: blob.type, text: await blob.text() },
        thumb: { type: thumb.type, text: await thumb.text() },
      })),
  )
}

async function unzipFile(file: File) {
  return unzipSync(new Uint8Array(await file.arrayBuffer()))
}

describe('匯出照片備份', () => {
  it('匯出照片備份（Happy Path）', async () => {
    await seedPhotos(
      photoRecord({ id: 'p1', caption: '簽到卡', recordDate: '2024-03-15' }),
      photoRecord({ id: 'p2', studentId: 's2', recordDate: '2024-05-02' }),
    )
    const { shared } = stubShareSheet()

    await exportPhotoBackup(NOW)

    expect(shared).toHaveLength(1)
    const entries = await unzipFile(shared[0]!)
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!)) as {
      app: string
      photos: { id: string; studentId: string; recordDate: string; caption: string }[]
    }
    expect(manifest.app).toBe('bloomin-photos')
    expect(manifest.photos.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
    expect(manifest.photos.find((p) => p.id === 'p1')).toMatchObject({
      studentId: 's1',
      recordDate: '2024-03-15',
      caption: '簽到卡',
    })
    expect(strFromU8(entries['photos/p1.jpg']!)).toBe('BLOB-p1')
    expect(strFromU8(entries['photos/p2.jpg']!)).toBe('BLOB-p2')
    expect(await loadPhotoBackupAt()).toBe(NOW.toISOString())
  })

  it('照片備份透過分享面板送出（Integration）', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))
    const { shared } = stubShareSheet()

    const outcome = await exportPhotoBackup(NOW)

    expect(outcome).toBe('shared')
    const name = shared[0]!.name
    expect(name.startsWith('bloomin-照片備份-')).toBe(true)
    expect(name.endsWith('.zip')).toBe(true)
  })

  it('取消分享時不算備份完成（Error Handling）', async () => {
    await savePhotoBackupAt('2026-09-01T00:00:00Z')
    await seedPhotos(photoRecord({ id: 'p1' }))
    stubShareSheet('cancel')

    const outcome = await exportPhotoBackup(NOW)

    expect(await loadPhotoBackupAt()).toBe('2026-09-01T00:00:00Z')
    expect(describeExport(outcome)).toContain('這次沒有備份照片')
  })
})

describe('匯入照片備份', () => {
  it('匯入照片備份（Happy Path）', async () => {
    const p1 = photoRecord({ id: 'p1', studentId: 's1', recordDate: '2024-03-15', caption: '簽到卡', width: 1500, height: 2000 })
    const p2 = photoRecord({ id: 'p2', studentId: 's2', recordDate: '2023-12-01', createdAt: '2026-09-02T10:00:00Z' })
    const zip = await backupZip([p1, p2])

    const result = await importPhotoBackup(zip, new Set(['s1', 's2']))

    for (const expected of [p1, p2]) {
      const got = await getPhoto(expected.id)
      expect(got).toBeDefined()
      const { blob, thumb, ...meta } = got!
      const { blob: _b, thumb: _t, ...expectedMeta } = expected
      expect(meta).toEqual(expectedMeta)
      expect(blob.type).toBe('image/jpeg')
      expect(await blob.text()).toBe(`BLOB-${expected.id}`)
      expect(await thumb.text()).toBe(`THUMB-${expected.id}`)
    }
    expect(result).toMatchObject({ ok: true, added: 2 })
    expect(describeImport(result)).toContain('新增 2 張')
  })

  it('已存在的照片在匯入時略過（Edge Case）', async () => {
    await seedPhotos(photoRecord({ id: 'p1', caption: '本機版本' }))
    const zip = await backupZip([photoRecord({ id: 'p1', caption: '備份版本' }), photoRecord({ id: 'p2' })])

    const result = await importPhotoBackup(zip, new Set(['s1']))

    expect((await getPhoto('p1'))!.caption).toBe('本機版本')
    expect(await getPhoto('p2')).toBeDefined()
    expect(result).toMatchObject({ ok: true, added: 1, skippedExisting: 1 })
    expect(describeImport(result)).toContain('新增 1 張')
    expect(describeImport(result)).toContain('略過 1 張已存在')
  })

  it('找不到所屬學生的照片仍會匯入（Edge Case）', async () => {
    const zip = await backupZip([photoRecord({ id: 'p9', studentId: 's9' })])

    // 目前資料裡只有 s1，沒有 s9（例如還沒還原 JSON 資料備份）
    const result = await importPhotoBackup(zip, new Set(['s1']))

    expect(await getPhoto('p9')).toBeDefined()
    expect(result).toMatchObject({ ok: true, added: 1, orphaned: 1 })
    expect(describeImport(result)).toContain('其中 1 張屬於目前找不到的學生')
  })

  it('缺少圖檔的項目被略過（Error Handling）', async () => {
    const zip = await backupZip([photoRecord({ id: 'p1' }), photoRecord({ id: 'p2' })], {
      omitFiles: ['p2'],
      manifest: {},
    })

    const result = await importPhotoBackup(zip, new Set(['s1']))

    expect(await getPhoto('p1')).toBeDefined()
    expect(await getPhoto('p2')).toBeUndefined()
    expect(result).toMatchObject({ ok: true, added: 1, missingFile: 1 })
    expect(describeImport(result)).toContain('略過 1 張檔案缺失')
  })

  it('匯入途中空間不足時保留已匯入的部分（Error Handling）', async () => {
    const zip = await backupZip([photoRecord({ id: 'p1' }), photoRecord({ id: 'p2' }), photoRecord({ id: 'p3' })])
    // 裝置空間只夠再存 1 張：第一次寫入成功，之後瀏覽器丟 QuotaExceededError
    const realPut = IDBObjectStore.prototype.put
    let writes = 0
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (writes++ < 1) return realPut.apply(this, args)
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })

    const result = await importPhotoBackup(zip, new Set(['s1']))

    vi.restoreAllMocks()
    expect(await getPhoto('p1')).toBeDefined()
    expect(result).toMatchObject({ ok: true, added: 1, noSpace: 2 })
    expect(describeImport(result)).toContain('已匯入 1 張、2 張因空間不足未匯入')
  })

  it('刪除後可從備份找回（State）', async () => {
    const p1 = photoRecord({ id: 'p1', caption: '要找回的那張' })
    const zip = await backupZip([p1])
    await seedPhotos(p1)
    await deletePhoto('p1')
    expect(await getPhoto('p1')).toBeUndefined()

    await importPhotoBackup(zip, new Set(['s1']))

    const back = await getPhoto('p1')
    expect(back!.caption).toBe('要找回的那張')
    expect(await back!.blob.text()).toBe('BLOB-p1')
  })

  it('匯出的備份可被匯入還原（Integration）', async () => {
    await seedPhotos(
      photoRecord({ id: 'p1', caption: '第 1 頁', width: 1500, height: 2000 }),
      photoRecord({ id: 'p2', studentId: 's2', recordDate: '2019-01-05', createdAt: '2026-09-02T10:00:00Z' }),
    )
    const before = await snapshot()
    const { shared } = stubShareSheet()

    await exportPhotoBackup(NOW)
    const db = await getDb()
    await db.clear(PHOTOS_STORE)
    expect(await listAllPhotos()).toEqual([])
    await importPhotoBackup(shared[0]!, new Set(['s1', 's2']))

    expect(await snapshot()).toEqual(before)
  })
})


describe('無效的照片備份', () => {
  const invalidFiles: [string, () => Promise<File>][] = [
    ['不是 zip', async () => new File(['這是一張照片，不是備份'], 'x.zip')],
    [
      '缺少 manifest.json',
      async () =>
        new File([zipSync({ 'photos/p2.jpg': strToU8('BLOB-p2') }, { level: 0 })], 'x.zip'),
    ],
    [
      'manifest 的 app 不是 bloomin-photos',
      () => backupZip([photoRecord({ id: 'p2' })], { omitFiles: [], manifest: { app: 'someotherapp' } }),
    ],
    [
      'manifest 的 schemaVersion 比 App 新',
      () => backupZip([photoRecord({ id: 'p2' })], { omitFiles: [], manifest: { schemaVersion: 2 } }),
    ],
  ]

  it.each(invalidFiles)('無效的照片備份被整份拒絕（Error Handling）：%s', async (_problem, makeFile) => {
    await seedPhotos(photoRecord({ id: 'p1' }))

    const result = await importPhotoBackup(await makeFile(), new Set(['s1']))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).not.toBe('')
    expect((await listAllPhotos()).map((p) => p.id)).toEqual(['p1'])
  })
})
