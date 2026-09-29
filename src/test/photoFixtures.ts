import { getDb, PHOTO_BLOBS_STORE, PHOTOS_STORE } from '../store/db'
import type { Photo } from '../store/photos'

/*
 * 直接把 Given 狀態寫進 photos store。blob / thumb 的內容帶上 id，
 * 測試可以分辨讀到的是哪一張、是原圖還是縮圖。
 */

export function photoRecord(fields: Partial<Photo> & { id: string }): Photo {
  return {
    studentId: 's1',
    recordDate: '2024-03-15',
    caption: '',
    blob: new Blob([`BLOB-${fields.id}`], { type: 'image/jpeg' }),
    thumb: new Blob([`THUMB-${fields.id}`], { type: 'image/jpeg' }),
    width: 2000,
    height: 1500,
    createdAt: '2026-09-01T10:00:00Z',
    ...fields,
  }
}

/** 依 schema.dbml 的結構寫入：photos 只放中繼資料與縮圖，原圖放 photoBlobs（key 同 id）。 */
export async function seedPhotos(...photos: Photo[]): Promise<void> {
  const db = await getDb()
  for (const { blob, ...record } of photos) {
    await db.put(PHOTOS_STORE, record)
    await db.put(PHOTO_BLOBS_STORE, blob, record.id)
  }
}

/** 清空照片（兩個 store 一起），測試之間互不影響。 */
export async function clearPhotoStores(): Promise<void> {
  const db = await getDb()
  await db.clear(PHOTOS_STORE)
  await db.clear(PHOTO_BLOBS_STORE)
}
