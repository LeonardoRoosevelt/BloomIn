import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPhotoBackup, describeImport, importPhotoBackup, photoBackupFileName } from './photoBackup'
import { deletePhoto, getPhoto, listAllPhotos, listStudentPhotosWithBlobs } from './photos'
import { clearPhotoStores, photoRecord, seedPhotos } from '../test/photoFixtures'
import { simulateTransactionAbort } from '../test/storageFull'

const NOW = new Date('2026-09-29T14:05:00+08:00')

beforeEach(async () => {
  await clearPhotoStores()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * 依照片備份格式手工組一份 zip（不經過匯出程式，當作獨立的 Given）。
 * omitFiles 列出的 id 只出現在 manifest，zip 內沒有圖檔；
 * entryPatch 依 id 覆寫 manifest 項目的欄位（值為 undefined 即從 JSON 中移除該欄位）。
 */
function backupZip(
  photos: ReturnType<typeof photoRecord>[],
  options: {
    omitFiles: string[]
    manifest: Record<string, unknown>
    entryPatch: Record<string, Record<string, unknown>>
  } = { omitFiles: [], manifest: {}, entryPatch: {} },
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
      entries.push({ ...meta, file, thumbFile, ...options.entryPatch[p.id] })
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

describe('照片備份檔名', () => {
  it('學生姓名含檔名不允許的字元時仍能匯出（Edge Case）', () => {
    const name = photoBackupFileName(NOW, { kind: 'student', studentId: 's1', studentName: 'A/B\\C:D*E?F"G<H>I|J' })

    for (const forbidden of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
      expect(name).not.toContain(forbidden)
    }
    expect(name.startsWith('bloomin-照片備份-')).toBe(true)
    expect(name.endsWith('.zip')).toBe(true)
    // 姓名的其餘部分仍看得出來
    expect(name).toMatch(/A.B.C.D.E.F.G.H.I.J/)
  })
})

describe('匯入照片備份', () => {
  it('匯入照片備份（Happy Path）', async () => {
    const p1 = photoRecord({ id: 'p1', studentId: 's1', recordDate: '2024-03-15', caption: '簽到卡', width: 1500, height: 2000 })
    const p2 = photoRecord({ id: 'p2', studentId: 's2', recordDate: '2023-12-01', createdAt: '2026-09-02T10:00:00.000Z' })
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
      entryPatch: {},
    })

    const result = await importPhotoBackup(zip, new Set(['s1']))

    expect(await getPhoto('p1')).toBeDefined()
    expect(await getPhoto('p2')).toBeUndefined()
    expect(result).toMatchObject({ ok: true, added: 1, missingFile: 1 })
    expect(describeImport(result)).toContain('略過 1 張檔案缺失')
  })

  it('匯入途中空間不足時保留已匯入的部分（Error Handling）', async () => {
    const zip = await backupZip([photoRecord({ id: 'p1' }), photoRecord({ id: 'p2' }), photoRecord({ id: 'p3' })])
    // 裝置空間只夠再存 1 張：一張照片是 photos＋photoBlobs 兩次寫入，放行這兩次，之後瀏覽器丟 QuotaExceededError
    const realPut = IDBObjectStore.prototype.put
    let writes = 0
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (writes++ < 2) return realPut.apply(this, args)
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

  it('匯出的學生照片備份可被匯入還原（Integration）', async () => {
    await seedPhotos(
      photoRecord({ id: 'p1', caption: '第 1 頁', width: 1500, height: 2000 }),
      photoRecord({ id: 'p2', recordDate: '2019-01-05', createdAt: '2026-09-02T10:00:00.000Z' }),
    )
    const before = await snapshot()
    const scope = { kind: 'student', studentId: 's1', studentName: '王小明' } as const
    const zip = await buildPhotoBackup(await listStudentPhotosWithBlobs('s1'), NOW, scope)

    await clearPhotoStores()
    expect(await listAllPhotos()).toEqual([])
    await importPhotoBackup(zip, new Set(['s1']))

    expect(await snapshot()).toEqual(before)
  })

  it('舊版的全部照片備份仍可匯入（Integration）', async () => {
    // 逐學生匯出之前的格式：manifest 沒有 scope，一份含多位學生的照片（backupZip 不寫 scope）
    const zip = await backupZip([photoRecord({ id: 'p1', studentId: 's1' }), photoRecord({ id: 'p2', studentId: 's2' })])
    const manifest = JSON.parse(strFromU8(unzipSync(new Uint8Array(await zip.arrayBuffer()))['manifest.json']!)) as object
    expect(manifest).not.toHaveProperty('scope')

    const result = await importPhotoBackup(zip, new Set(['s1', 's2']))

    expect(result).toMatchObject({ ok: true, added: 2 })
    expect((await getPhoto('p1'))!.studentId).toBe('s1')
    expect((await getPhoto('p2'))!.studentId).toBe('s2')
  })

  it('空間不足以交易中止回報時同樣視為空間不足（Error Handling）：匯入', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))
    const zip = await backupZip([photoRecord({ id: 'p2' }), photoRecord({ id: 'p3' })])
    simulateTransactionAbort('QuotaExceededError', 0)

    const result = await importPhotoBackup(zip, new Set(['s1']))

    vi.restoreAllMocks()
    expect(result).toMatchObject({ ok: true, added: 0, noSpace: 2 })
    expect(describeImport(result)).toContain('裝置儲存空間不足')
    expect((await listAllPhotos()).map((p) => p.id)).toEqual(['p1'])
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
      () => backupZip([photoRecord({ id: 'p2' })], { omitFiles: [], manifest: { app: 'someotherapp' }, entryPatch: {} }),
    ],
    [
      'manifest 的 schemaVersion 比 App 新',
      () => backupZip([photoRecord({ id: 'p2' })], { omitFiles: [], manifest: { schemaVersion: 2 }, entryPatch: {} }),
    ],
  ]

  /*
   * manifest 項目結構無效：第 1 筆 p2 完全合法（含圖檔），第 2 筆 p3 有問題。
   * 若驗證不是在寫入前對「整份」做完，p2 會先被寫進去 —— 這正是要擋的情況。
   */
  const brokenEntry = (patch: Record<string, unknown>) => () =>
    backupZip([photoRecord({ id: 'p2' }), photoRecord({ id: 'p3' })], {
      omitFiles: [],
      manifest: {},
      entryPatch: { p3: patch },
    })
  const brokenEntries: [string, Record<string, unknown>][] = [
    ['manifest 中有欄位缺漏的項目（studentId）', { studentId: undefined }],
    ['manifest 中有欄位缺漏的項目（recordDate）', { recordDate: undefined }],
    ['manifest 中有欄位缺漏的項目（caption）', { caption: undefined }],
    ['manifest 中有欄位缺漏的項目（createdAt）', { createdAt: undefined }],
    ['manifest 中有欄位缺漏的項目（thumbFile）', { thumbFile: undefined }],
    ['manifest 中有 id 不是非空字串的項目（缺漏）', { id: undefined }],
    ['manifest 中有 id 不是非空字串的項目（null）', { id: null }],
    ['manifest 中有 id 不是非空字串的項目（數字）', { id: 123 }],
    ['manifest 中有 id 不是非空字串的項目（空字串）', { id: '' }],
    ['manifest 中有 recordDate 不是 YYYY-MM-DD 的項目（斜線）', { recordDate: '2024/03/15' }],
    ['manifest 中有 recordDate 不是 YYYY-MM-DD 的項目（未補零）', { recordDate: '2024-3-5' }],
    ['manifest 中有 recordDate 不是實際存在日期的項目（13 月 99 日）', { recordDate: '2024-13-99' }],
    ['manifest 中有 recordDate 不是實際存在日期的項目（非閏年 2 月 29 日）', { recordDate: '2023-02-29' }],
    ['manifest 中有 createdAt 不是 ISO 8601 的項目（空白分隔）', { createdAt: '2026-09-01 10:00:00' }],
    ['manifest 中有 createdAt 不是 ISO 8601 的項目（時區位移）', { createdAt: '2026-09-01T18:00:00+08:00' }],
    ['manifest 中有 createdAt 不是 ISO 8601 的項目（缺毫秒）', { createdAt: '2026-09-01T10:00:00Z' }],
    ['manifest 中有 width 或 height 不是正整數的項目（0）', { width: 0 }],
    ['manifest 中有 width 或 height 不是正整數的項目（小數）', { height: 1.5 }],
    ['manifest 中有 width 或 height 不是正整數的項目（字串）', { width: '2000' }],
    ['manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（原型鏈屬性）', { file: 'constructor' }],
    ['manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（manifest.json）', { file: 'manifest.json' }],
    ['manifest 項目的檔案路徑不在 photos/ 或 thumbs/ 之下（縮圖指向原圖目錄）', { thumbFile: 'photos/p3.jpg' }],
  ]
  for (const [problem, patch] of brokenEntries) invalidFiles.push([problem, brokenEntry(patch)])

  it.each(invalidFiles)('無效的照片備份被整份拒絕（Error Handling）：%s', async (problem, makeFile) => {
    await seedPhotos(photoRecord({ id: 'p1' }))

    const result = await importPhotoBackup(await makeFile(), new Set(['s1']))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).not.toBe('')
    if (problem.startsWith('manifest 中有') || problem.startsWith('manifest 項目')) {
      expect(result.error).toContain('第 2 筆')
    }
    expect((await listAllPhotos()).map((p) => p.id)).toEqual(['p1'])
  })
})
