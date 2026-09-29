import { getDb, PHOTOS_STORE } from '../store/db'
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

export async function seedPhotos(...photos: Photo[]): Promise<void> {
  const db = await getDb()
  for (const p of photos) await db.put(PHOTOS_STORE, p)
}
