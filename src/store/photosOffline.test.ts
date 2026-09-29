import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareFile } from '../lib/share'
import { loadPhotoBackupTime, savePhotoBackupTime } from './db'
import { buildPhotoBackup, importPhotoBackup } from './photoBackup'
import {
  addPhotoFiles,
  deletePhoto,
  getPhoto,
  listAllPhotos,
  listPhotosByMonth,
  listStudentPhotosWithBlobs,
  updatePhoto,
} from './photos'
import { fakeCodec, fakeImageFile } from '../test/fakeCodec'
import { clearPhotoStores } from '../test/photoFixtures'

/*
 * 「照片只存在本機」的證明方式：把瀏覽器所有送資料出去的管道換成
 * 「記下呼叫並拋錯」（等同裝置完全沒有網路），再把照片功能從頭跑一遍。
 * 只要任何一步偷偷連網，這裡會同時看到呼叫紀錄與流程失敗。
 */
let networkCalls: string[]
let shared: File[]

beforeEach(async () => {
  networkCalls = []
  shared = []
  const offline = (channel: string) => (...args: unknown[]) => {
    networkCalls.push(`${channel} ${String(args[0])}`)
    throw new TypeError('Network request failed: device is offline')
  }
  vi.stubGlobal('fetch', offline('fetch'))
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open = offline('XMLHttpRequest.open')
      send = offline('XMLHttpRequest.send')
    },
  )
  vi.stubGlobal('navigator', {
    sendBeacon: offline('navigator.sendBeacon'),
    // 分享面板是裝置本機的系統介面（存到「檔案」、AirDrop），不經過 App 的伺服器
    canShare: () => true,
    share: async ({ files }: { files: File[] }) => {
      shared.push(...files)
    },
  })
  await clearPhotoStores()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 照片備份區「匯出某位學生」的同一套步驟：讀照片 → 打包 → 分享面板 → 記錄時間。 */
async function exportStudentBackup(studentId: string, now: Date) {
  const photos = await listStudentPhotosWithBlobs(studentId)
  const file = await buildPhotoBackup(photos, now, { kind: 'student', studentId, studentName: '王小明' })
  const outcome = await shareFile(file, 'BloomIn 照片備份')
  if (outcome !== 'cancelled') await savePhotoBackupTime(studentId, now.toISOString())
  return outcome
}

describe('本機與離線', () => {
  it('照片只存在本機且不需登入（Permission）', async () => {
    // 沒有任何登入、帳號或憑證設定，直接新增與匯出
    const added = await addPhotoFiles(
      's1',
      [fakeImageFile(4000, 3000)],
      { recordDate: '2024-03-15', caption: '簽到卡' },
      fakeCodec,
    )
    const outcome = await exportStudentBackup('s1', new Date('2026-09-29T10:00:00Z'))

    expect(added).toMatchObject({ added: 1, unreadable: 0, noSpace: 0 })
    expect(outcome).toBe('shared')
    expect(shared).toHaveLength(1)
    expect(networkCalls).toEqual([])
  })

  it('離線時照片功能完整可用（Integration）', async () => {
    // 新增
    await addPhotoFiles(
      's1',
      [fakeImageFile(4000, 3000), fakeImageFile(1200, 800)],
      { recordDate: '2024-03-15', caption: '' },
      fakeCodec,
    )
    // 列表與檢視
    const groups = await listPhotosByMonth('s1')
    expect(groups.map((g) => g.photos.length)).toEqual([2])
    const [first, second] = groups[0]!.photos
    const viewed = await getPhoto(first!.id)
    expect(viewed!.blob.type).toBe('image/jpeg')
    // 編輯與刪除
    await updatePhoto(first!.id, { recordDate: '2023-09-01', caption: '舊簽到簿' })
    await deletePhoto(second!.id)
    expect((await listAllPhotos()).map((p) => p.id)).toEqual([first!.id])
    // 匯出
    expect(await exportStudentBackup('s1', new Date('2026-09-29T10:00:00Z'))).toBe('shared')
    expect(await loadPhotoBackupTime('s1')).toBe('2026-09-29T10:00:00.000Z')
    // 清空後匯入同一份
    await clearPhotoStores()
    const result = await importPhotoBackup(shared[0]!, new Set(['s1']))

    expect(result).toMatchObject({ ok: true, added: 1 })
    expect((await getPhoto(first!.id))!.caption).toBe('舊簽到簿')
    expect(networkCalls).toEqual([])
  })
})
