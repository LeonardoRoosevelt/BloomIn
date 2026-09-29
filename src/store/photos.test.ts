import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, PHOTO_BLOBS_STORE, PHOTOS_STORE } from './db'
import {
  addPhotoFiles,
  deletePhoto,
  deleteUnassignedPhotos,
  describeAddResult,
  getPhoto,
  listAllPhotos,
  listPhotosByMonth,
  updatePhoto,
} from './photos'
import { encodedOf, fakeCodec, fakeImageFile, unreadableFile } from '../test/fakeCodec'
import { clearPhotoStores, photoRecord, seedPhotos } from '../test/photoFixtures'
import { simulateTransactionAbort } from '../test/storageFull'
import { createInitialState } from '../domain/types'
import { useStore } from './useStore'

beforeEach(async () => {
  await clearPhotoStores()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 模擬裝置儲存空間已滿：瀏覽器在寫入時丟出 QuotaExceededError。 */
function simulateStorageFull() {
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
}

async function photosOf(studentId: string) {
  return (await listAllPhotos()).filter((p) => p.studentId === studentId)
}

describe('新增照片', () => {
  it('新增一張照片（Happy Path）', async () => {
    // Given students 中存在 s1；photos 中沒有 s1 的記錄
    expect(await photosOf('s1')).toEqual([])

    await addPhotoFiles(
      's1',
      [fakeImageFile(4000, 3000)],
      { recordDate: '2024-03-15', caption: '上學期簽到卡 第 1 頁' },
      fakeCodec,
    )

    const photos = await photosOf('s1')
    expect(photos).toHaveLength(1)
    const p = photos[0]!
    expect(p.recordDate).toBe('2024-03-15')
    expect(p.caption).toBe('上學期簽到卡 第 1 頁')
    expect(p.blob.type).toBe('image/jpeg')
    expect(p.width).toBe(2000)
    expect(p.height).toBe(1500)
    expect(await encodedOf(p.blob)).toEqual({ width: 2000, height: 1500, quality: 0.85 })
    expect(p.thumb.type).toBe('image/jpeg')
    const thumb = await encodedOf(p.thumb)
    expect(Math.max(thumb.width, thumb.height)).toBe(400)

    // photos 中的記錄只含中繼資料與 thumb，原圖存於 photoBlobs（key 同該記錄的 id）
    const db = await getDb()
    const stored = (await db.get(PHOTOS_STORE, p.id)) as Record<string, unknown>
    expect(stored).not.toHaveProperty('blob')
    expect(await encodedOf(stored.thumb as Blob)).toEqual(thumb)
    const original = (await db.get(PHOTO_BLOBS_STORE, p.id)) as Blob
    expect(original.type).toBe('image/jpeg')
    expect(await encodedOf(original)).toEqual({ width: 2000, height: 1500, quality: 0.85 })
  })

  it('一次新增多張照片（Happy Path）', async () => {
    const files = [fakeImageFile(4000, 3000), fakeImageFile(3000, 4000), fakeImageFile(4032, 3024)]

    // 多張時畫面只提供日期，說明一律留空（之後逐張編輯）
    await addPhotoFiles('s1', files, { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    const photos = await photosOf('s1')
    expect(photos).toHaveLength(3)
    expect(photos.map((p) => p.recordDate)).toEqual(['2024-03-15', '2024-03-15', '2024-03-15'])
    expect(photos.map((p) => p.caption)).toEqual(['', '', ''])
    // 每張各自成為一筆紀錄
    expect(new Set(photos.map((p) => p.id)).size).toBe(3)
  })

  it('小於上限的照片不放大（Edge Case）', async () => {
    await addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    const [p] = await photosOf('s1')
    expect(p!.width).toBe(1200)
    expect(p!.height).toBe(800)
    expect(p!.blob.type).toBe('image/jpeg')
    expect(await encodedOf(p!.blob)).toMatchObject({ width: 1200, height: 800 })
  })

  it('直式照片的方向與相簿一致（Edge Case）', async () => {
    // Given 一張帶 EXIF 旋轉 90 度、像素為 4000x3000 的照片（相簿裡看起來是直的）
    const file = fakeImageFile(4000, 3000, { exifRotate90: true })

    await addPhotoFiles('s1', [file], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    const [p] = await photosOf('s1')
    expect(p!.width).toBe(1500)
    expect(p!.height).toBe(2000)
    expect(await encodedOf(p!.blob)).toMatchObject({ width: 1500, height: 2000 })
  })

  it('超大原圖仍能縮成上限尺寸（Integration）', async () => {
    await addPhotoFiles('s1', [fakeImageFile(8000, 6000)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    const [p] = await photosOf('s1')
    expect(p!.width).toBe(2000)
    expect(p!.height).toBe(1500)
  })

  it('接受任意合法的紀錄日期（Edge Case）', async () => {
    await addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2019-01-05', caption: '' }, fakeCodec)

    const [p] = await photosOf('s1')
    expect(p!.recordDate).toBe('2019-01-05')
  })

  it('已封存學生的紀錄本照常可用（Edge Case）', async () => {
    // Given 學生 s1 已封存 —— 照片層不讀學生資料，封存只影響學生清單
    await addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    expect(await photosOf('s1')).toHaveLength(1)
  })
})

describe('無法處理的輸入', () => {
  it('無法解碼的檔案被略過（Error Handling）', async () => {
    const result = await addPhotoFiles(
      's1',
      [unreadableFile(), fakeImageFile(1200, 800)],
      { recordDate: '2024-03-15', caption: '' },
      fakeCodec,
    )

    expect(await photosOf('s1')).toHaveLength(1)
    expect(result).toMatchObject({ added: 1, unreadable: 1 })
  })

  it('儲存空間不足時該張不寫入（Error Handling）', async () => {
    await addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)
    const before = await listAllPhotos()
    expect(before).toHaveLength(1)
    simulateStorageFull()

    const result = await addPhotoFiles(
      's1',
      [fakeImageFile(4000, 3000)],
      { recordDate: '2024-03-16', caption: '' },
      fakeCodec,
    )

    expect(describeAddResult(result)).toContain('裝置儲存空間不足')
    vi.restoreAllMocks()
    expect((await listAllPhotos()).map((p) => p.id)).toEqual([before[0]!.id])
    // photoBlobs 中也只有 p1 的原圖，沒有留下半張
    expect(await (await getDb()).getAllKeys(PHOTO_BLOBS_STORE)).toEqual([before[0]!.id])
  })

  it('空間不足以交易中止回報時同樣視為空間不足（Error Handling）：新增照片', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))
    simulateTransactionAbort('QuotaExceededError', 0)

    const result = await addPhotoFiles(
      's1',
      [fakeImageFile(4000, 3000), fakeImageFile(1200, 800)],
      { recordDate: '2024-03-16', caption: '' },
      fakeCodec,
    )

    expect(result).toMatchObject({ added: 0, noSpace: 2 })
    expect(describeAddResult(result)).toContain('裝置儲存空間不足')
    vi.restoreAllMocks()
    expect((await listAllPhotos()).map((p) => p.id)).toEqual(['p1'])
    expect(await (await getDb()).getAllKeys(PHOTO_BLOBS_STORE)).toEqual(['p1'])
  })

  it('非空間不足的交易中止不會被誤報為空間不足（Error Handling）', async () => {
    simulateTransactionAbort('UnknownError', 0)

    const attempt = addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-16', caption: '' }, fakeCodec)

    // 錯誤照常拋出，不會被包裝成「空間不足」的結果
    await expect(attempt).rejects.toMatchObject({ name: expect.not.stringMatching('QuotaExceededError') })
  })
})


describe('編輯照片', () => {
  it('編輯照片的日期與說明（Happy Path）', async () => {
    await addPhotoFiles('s1', [fakeImageFile(4000, 3000)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)
    const [original] = await listAllPhotos()
    const id = original!.id

    await updatePhoto(id, { recordDate: '2023-09-01', caption: '舊簽到簿' })

    const edited = await getPhoto(id)
    expect(edited!.recordDate).toBe('2023-09-01')
    expect(edited!.caption).toBe('舊簽到簿')
    // 照片本身不變
    expect(await edited!.blob.text()).toBe(await original!.blob.text())
    expect(await edited!.thumb.text()).toBe(await original!.thumb.text())
    expect(edited!.width).toBe(original!.width)
    expect(edited!.createdAt).toBe(original!.createdAt)
  })
})

describe('紀錄本列表', () => {
  it('照片依紀錄日期由新到舊並依月分組（Edge Case）', async () => {
    await seedPhotos(
      photoRecord({ id: 'p1', recordDate: '2024-03-15', createdAt: '2026-09-01T10:00:00Z' }),
      photoRecord({ id: 'p2', recordDate: '2024-05-02', createdAt: '2026-09-01T10:00:00Z' }),
      photoRecord({ id: 'p3', recordDate: '2024-03-15', createdAt: '2026-09-02T10:00:00Z' }),
      // 別的學生的照片不該混進來
      photoRecord({ id: 'x1', studentId: 's2', recordDate: '2024-04-01' }),
    )

    // 記下列表開了哪些 store 的交易
    const realTransaction = IDBDatabase.prototype.transaction
    const opened: string[] = []
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      opened.push(...(typeof args[0] === 'string' ? [args[0]] : Array.from(args[0])))
      return realTransaction.apply(this, args)
    })

    const groups = await listPhotosByMonth('s1')
    vi.restoreAllMocks()

    expect(groups.map((g) => g.month)).toEqual(['2024-05', '2024-03'])
    expect(groups[1]!.photos.map((p) => p.id)).toEqual(['p3', 'p1'])
    // 列表只讀取 photos 的 thumb，不讀取 photoBlobs 的原圖
    expect(opened).toContain(PHOTOS_STORE)
    expect(opened).not.toContain(PHOTO_BLOBS_STORE)
    for (const g of groups) {
      for (const p of g.photos) {
        expect(p).not.toHaveProperty('blob')
        expect(await p.thumb.text()).toBe(`THUMB-${p.id}`)
      }
    }
  })
})

describe('與資料備份互不影響', () => {
  it('還原資料備份不影響照片（Edge Case）', async () => {
    await seedPhotos(photoRecord({ id: 'p1' }))

    // 還原一份 JSON 資料備份
    await useStore.getState().importState(createInitialState())
    expect(await getPhoto('p1')).toBeDefined()

    // 或執行復原匯入
    expect(await useStore.getState().rollbackImport()).toBe(true)
    expect(await getPhoto('p1')).toBeDefined()
  })
})

describe('同一交易中的請求出錯', () => {
  /** 兩個 store 的原始內容（照片 id 與學生、原圖 key），用來比對操作前後是否完全相同。 */
  async function rawStores() {
    const db = await getDb()
    const photos = ((await db.getAll(PHOTOS_STORE)) as { id: string; studentId: string }[])
      .map((p) => `${p.id}:${p.studentId}`)
      .sort()
    const blobs = ((await db.getAllKeys(PHOTO_BLOBS_STORE)) as string[]).sort()
    return { photos, blobs }
  }

  /** 讓某個 store 的第 nth 次 put／delete 同步拋出指定錯誤（瀏覽器邊界的模擬）。 */
  function failOn(method: 'put' | 'delete', storeName: string, errorName: string, nth: number) {
    const real = IDBObjectStore.prototype[method] as (...args: unknown[]) => IDBRequest
    let calls = 0
    vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore, ...args: unknown[]) {
      if (this.name === storeName && ++calls === nth) throw new DOMException(`${errorName} in ${storeName}`, errorName)
      return real.apply(this, args)
    } as never)
  }

  let unhandled: unknown[]
  const onUnhandled = (reason: unknown) => unhandled.push(reason)

  beforeEach(async () => {
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
    await seedPhotos(
      photoRecord({ id: 'p1', studentId: 's1' }),
      photoRecord({ id: 'p8', studentId: 's9' }),
      photoRecord({ id: 'p9', studentId: 's9' }),
    )
  })

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
  })

  /** 等一下讓遲到的 rejection 浮現，再檢查沒有未處理的錯誤。 */
  async function expectNoUnhandled() {
    await new Promise((r) => setTimeout(r, 20))
    expect(unhandled).toEqual([])
  }

  it('寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）：新增一張照片、原圖 DataCloneError', async () => {
    const before = await rawStores()
    failOn('put', PHOTO_BLOBS_STORE, 'DataCloneError', 1)

    const attempt = addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    await expect(attempt).rejects.toMatchObject({ name: 'DataCloneError' })
    vi.restoreAllMocks()
    expect(await rawStores()).toEqual(before)
    await expectNoUnhandled()
  })

  it('寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）：新增一張照片、原圖 QuotaExceededError', async () => {
    const before = await rawStores()
    failOn('put', PHOTO_BLOBS_STORE, 'QuotaExceededError', 1)

    const result = await addPhotoFiles('s1', [fakeImageFile(1200, 800)], { recordDate: '2024-03-15', caption: '' }, fakeCodec)

    expect(describeAddResult(result)).toContain('裝置儲存空間不足')
    vi.restoreAllMocks()
    expect(await rawStores()).toEqual(before)
    await expectNoUnhandled()
  })

  it('寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）：刪除 p1、原圖 UnknownError', async () => {
    const before = await rawStores()
    failOn('delete', PHOTO_BLOBS_STORE, 'UnknownError', 1)

    await expect(deletePhoto('p1')).rejects.toMatchObject({ name: 'UnknownError' })
    vi.restoreAllMocks()
    expect(await rawStores()).toEqual(before)
    await expectNoUnhandled()
  })

  it('寫入或刪除途中出錯時兩邊都不留下變更（Error Handling）：清除未歸屬的照片、第二張的刪除 UnknownError', async () => {
    const before = await rawStores()
    // 刪除順序：p8 的中繼資料、p8 的原圖、p9 的中繼資料（第二次刪 photos 時出錯）
    failOn('delete', PHOTOS_STORE, 'UnknownError', 2)

    await expect(deleteUnassignedPhotos(new Set(['s1']))).rejects.toMatchObject({ name: 'UnknownError' })
    vi.restoreAllMocks()
    expect(await rawStores()).toEqual(before)
    await expectNoUnhandled()
  })
})
