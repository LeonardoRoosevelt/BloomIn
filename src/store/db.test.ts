import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { getDb, loadState } from './db'

describe('IndexedDB 結構', () => {
  it('資料庫升級保留既有資料（State）', async () => {
    // Given 資料庫版本為 1，kv 中存有 state（模擬舊版 App 留下的資料庫）
    const legacyState = { schemaVersion: 1, students: [{ id: 's1', name: '小明' }] }
    const v1 = await openDB('bloomin', 1, {
      upgrade(db) {
        db.createObjectStore('kv')
      },
    })
    await v1.put('kv', legacyState, 'state')
    v1.close()

    // When App 以版本 2 開啟資料庫
    const loaded = await loadState()

    // Then kv 中的 state 完整保留
    expect(loaded).toEqual(legacyState)

    // And photos 已建立且可依 studentId 查詢
    const db = await getDb()
    expect(db.version).toBe(2)
    expect(db.objectStoreNames.contains('photos')).toBe(true)
    const tx = db.transaction('photos', 'readwrite')
    expect(tx.store.keyPath).toBe('id')
    expect(tx.store.indexNames.contains('studentId')).toBe(true)
    await tx.store.put({ id: 'p1', studentId: 's1' })
    await tx.store.put({ id: 'p2', studentId: 's2' })
    await tx.done
    const ofS1 = await db.getAllFromIndex('photos', 'studentId', 's1')
    expect(ofS1.map((p: { id: string }) => p.id)).toEqual(['p1'])

    // And photoBlobs 已建立，可依照片 id 存取原圖（out-of-line key：值直接是 Blob）
    expect(db.objectStoreNames.contains('photoBlobs')).toBe(true)
    const blobTx = db.transaction('photoBlobs', 'readwrite')
    expect(blobTx.store.keyPath).toBeNull()
    await blobTx.store.put(new Blob(['BLOB-p1'], { type: 'image/jpeg' }), 'p1')
    await blobTx.done
    expect(await ((await db.get('photoBlobs', 'p1')) as Blob).text()).toBe('BLOB-p1')
  })

  it('本分頁不會擋住較新版本的升級（State）', async () => {
    // Given App 以版本 2 開著資料庫
    const current = await getDb()
    expect(current.version).toBe(2)

    // When 另一個分頁以版本 3 開啟資料庫
    let blocked = false
    const newer = openDB('bloomin', 3, {
      blocked() {
        blocked = true
      },
    })
    const outcome = await Promise.race([
      newer.then(() => 'opened'),
      new Promise((resolve) => setTimeout(() => resolve('HUNG'), 500)),
    ])

    // Then 版本 3 的開啟不會被本分頁擋住
    expect(outcome).toBe('opened')
    expect(blocked).toBe(false)
    ;(await newer).close()
  })
})
