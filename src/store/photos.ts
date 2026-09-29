import { preparePhoto, type ImageCodec } from '../domain/photoImage'
import { monthKey } from '../lib/date'
import { newId } from '../lib/id'
import { getDb, PHOTO_BLOBS_STORE, PHOTOS_STORE } from './db'

/**
 * 學生照片紀錄本的一張照片（含原圖）。
 *
 * 與 domain/types 同樣不使用選填欄位：caption 空白就是空字串。
 * 刻意不進 AppState —— 照片是大型 Blob，放進 state 每次存檔都要重寫整包。
 * 存放時拆成兩處：photos 存 PhotoSummary（中繼資料＋縮圖），photoBlobs 存原圖（key 同 id）。
 */
export interface Photo {
  id: string
  /** 邏輯參照 Student.id，但不強制：匯入時允許暫時找不到學生 */
  studentId: string
  /** 紙本紀錄的日期（YYYY-MM-DD），不是拍照或上傳日期 */
  recordDate: string
  caption: string
  /** image/jpeg，長邊 ≤ 2000px */
  blob: Blob
  /** image/jpeg，長邊 ≤ 400px */
  thumb: Blob
  width: number
  height: number
  createdAt: string
}

/** 全部照片（含原圖）。 */
export async function listAllPhotos(): Promise<Photo[]> {
  const db = await getDb()
  const tx = db.transaction([PHOTOS_STORE, PHOTO_BLOBS_STORE], 'readonly')
  const records = (await tx.objectStore(PHOTOS_STORE).getAll()) as PhotoSummary[]
  const photos = await withBlobs(tx.objectStore(PHOTO_BLOBS_STORE), records)
  await tx.done
  return photos
}

/** 某位學生的所有照片（含原圖），照片備份逐位學生打包用。 */
export async function listStudentPhotosWithBlobs(studentId: string): Promise<Photo[]> {
  const db = await getDb()
  const tx = db.transaction([PHOTOS_STORE, PHOTO_BLOBS_STORE], 'readonly')
  const records = (await tx.objectStore(PHOTOS_STORE).index('studentId').getAll(studentId)) as PhotoSummary[]
  const photos = await withBlobs(tx.objectStore(PHOTO_BLOBS_STORE), records)
  await tx.done
  return photos
}

/** 替中繼資料補上原圖；原圖缺失的（理論上不會發生，兩邊同一交易寫入）不列入。 */
async function withBlobs(
  blobStore: { get(key: string): Promise<unknown> },
  records: readonly PhotoSummary[],
): Promise<Photo[]> {
  const photos: Photo[] = []
  for (const record of records) {
    const blob = (await blobStore.get(record.id)) as Blob | undefined
    if (blob) photos.push({ ...record, blob })
  }
  return photos
}

/** 學生詳情頁入口顯示的張數；用索引計數，不必把照片讀出來。 */
export async function countPhotos(studentId: string): Promise<number> {
  const db = await getDb()
  return db.countFromIndex(PHOTOS_STORE, 'studentId', studentId)
}

/** 每位學生（studentId）的照片張數；照片備份區用來列出有照片的學生。只讀 photos，不碰原圖。 */
export async function countPhotosByStudent(): Promise<Map<string, number>> {
  const db = await getDb()
  const counts = new Map<string, number>()
  let cursor = await db.transaction(PHOTOS_STORE).store.index('studentId').openKeyCursor()
  while (cursor) {
    const studentId = cursor.key as string
    counts.set(studentId, (counts.get(studentId) ?? 0) + 1)
    cursor = await cursor.continue()
  }
  return counts
}

/** photos store 裡的記錄，也是列表用的照片：不帶原圖，畫面只能拿縮圖來顯示。 */
export type PhotoSummary = Omit<Photo, 'blob'>

/**
 * 某位學生的照片，依紀錄日期新到舊、同日依建立時間新到舊，並依月份分組。
 *
 * 一本紀錄本可能有上百張，列表若解碼 2000px 原圖會拖垮 iOS 的記憶體，
 * 因此只交出縮圖；原圖要另外用 getPhoto 取。
 */
export async function listPhotosByMonth(
  studentId: string,
): Promise<{ month: string; photos: PhotoSummary[] }[]> {
  const db = await getDb()
  // 只讀 photos：原圖在 photoBlobs，列表連它的檔案參照都不取回
  const all = (await db.getAllFromIndex(PHOTOS_STORE, 'studentId', studentId)) as PhotoSummary[]
  const sorted = all.sort((a, b) => {
    const byDate = b.recordDate.localeCompare(a.recordDate)
    return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt)
  })
  const groups: { month: string; photos: PhotoSummary[] }[] = []
  for (const p of sorted) {
    const month = monthKey(p.recordDate)
    const last = groups.at(-1)
    if (last?.month === month) last.photos.push(p)
    else groups.push({ month, photos: [p] })
  }
  return groups
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const db = await getDb()
  const tx = db.transaction([PHOTOS_STORE, PHOTO_BLOBS_STORE], 'readonly')
  const record = (await tx.objectStore(PHOTOS_STORE).get(id)) as PhotoSummary | undefined
  const [photo] = record ? await withBlobs(tx.objectStore(PHOTO_BLOBS_STORE), [record]) : []
  await tx.done
  return photo
}

/** 只改日期與說明；照片本身（blob / thumb）永遠不動。 */
export async function updatePhoto(
  id: string,
  patch: { recordDate: string; caption: string },
): Promise<void> {
  const db = await getDb()
  // 讀與寫放在同一個交易，避免兩次編輯交錯時互相覆蓋
  const tx = db.transaction(PHOTOS_STORE, 'readwrite')
  const current = (await tx.store.get(id)) as Photo | undefined
  if (current) await tx.store.put({ ...current, recordDate: patch.recordDate, caption: patch.caption })
  await tx.done
}

/**
 * 實體刪除：照片不牽涉帳務，不需要像學生那樣封存。
 * 無法復原（除非有照片備份），因此畫面上一定要先二次確認。
 * 中繼資料與原圖同一個交易刪除，不留孤立的原圖佔空間。
 */
export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction([PHOTOS_STORE, PHOTO_BLOBS_STORE], 'readwrite')
  await Promise.all([tx.objectStore(PHOTOS_STORE).delete(id), tx.objectStore(PHOTO_BLOBS_STORE).delete(id), tx.done])
}

/**
 * 寫入一張照片。空間不足時不論瀏覽器以哪種形式回報，拋出的都是 QuotaExceededError：
 * 交易被中止時，請求只會收到籠統的 AbortError，真正原因在 transaction.error，
 * 而它要等交易結束才確定。只看交易的 error，不把所有 AbortError 都當成空間不足。
 */
export async function putPhoto(photo: Photo): Promise<void> {
  const db = await getDb()
  // 中繼資料與原圖在同一個交易：空間不足時兩邊都不寫入，不會留下半張
  const tx = db.transaction([PHOTOS_STORE, PHOTO_BLOBS_STORE], 'readwrite')
  const { blob, ...record } = photo
  const requests: Promise<unknown>[] = []
  try {
    requests.push(tx.objectStore(PHOTOS_STORE).put(record))
    requests.push(tx.objectStore(PHOTO_BLOBS_STORE).put(blob, photo.id))
    await Promise.all([...requests, tx.done])
  } catch (err) {
    // 交易中止後，已送出的每個請求也都會 reject；若第二個請求同步拋錯，前一個請求的
    // promise 根本沒進到 Promise.all，會變成沒人處理的錯誤。錯誤由下方統一處理，這裡全部接住
    for (const request of requests) request.catch(() => undefined)
    await tx.done.catch(() => undefined)
    if (isQuotaError(tx.error)) throw tx.error
    throw err
  }
}

export interface AddPhotosResult {
  added: number
  /** 無法解碼而略過的檔案數（非圖片、格式不支援） */
  unreadable: number
  /** 因裝置空間不足而沒有存進去的張數 */
  noSpace: number
}

/**
 * 把使用者選的檔案逐張縮圖後存入。多張共用同一個紀錄日期與說明。
 */
export async function addPhotoFiles(
  studentId: string,
  files: readonly Blob[],
  meta: { recordDate: string; caption: string },
  codec: ImageCodec,
): Promise<AddPhotosResult> {
  let added = 0
  let unreadable = 0
  let noSpace = 0
  for (const [i, file] of files.entries()) {
    let prepared
    try {
      prepared = await preparePhoto(file, codec)
    } catch {
      // 一張讀不了不該拖累整批：略過並計數，其他張照常存入，也不留下殘缺紀錄
      unreadable++
      continue
    }
    const photo: Photo = {
      id: newId(),
      studentId,
      recordDate: meta.recordDate,
      caption: meta.caption,
      ...prepared,
      createdAt: new Date().toISOString(),
    }
    try {
      await putPhoto(photo)
    } catch (err) {
      if (!isQuotaError(err)) throw err
      // 空間已滿，後面的也存不進去，停下來回報剩幾張沒存
      noSpace = files.length - i
      break
    }
    added++
  }
  return { added, unreadable, noSpace }
}

export function describeAddResult(r: AddPhotosResult): string {
  const parts: string[] = []
  if (r.added > 0) parts.push(`已新增 ${r.added} 張。`)
  if (r.unreadable > 0) parts.push(`${r.unreadable} 個檔案無法讀取，已略過。`)
  if (r.noSpace > 0) parts.push(`裝置儲存空間不足，${r.noSpace} 張照片沒有存進去。`)
  return parts.join('')
}

/** IndexedDB 的空間不足會以 QuotaExceededError 呈現（可能是同步拋出或交易 abort）。 */
export function isQuotaError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'QuotaExceededError'
}
