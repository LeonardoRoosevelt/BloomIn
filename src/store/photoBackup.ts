import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { parseISODate, toISODate } from '../lib/date'
import type { ShareOutcome } from '../lib/share'
import { getDb, PHOTOS_STORE } from './db'
import { isQuotaError, putPhoto, type Photo } from './photos'

/**
 * 照片備份檔（zip）。
 *
 * 與 JSON 資料備份分開：照片體積大，塞進 JSON 會讓日常的資料備份變得又慢又大。
 * manifest 沿用資料備份的信封思路 —— 匯入時要能分辨「這是 BloomIn 的照片備份」
 * 與「某個剛好也是 zip 的檔案」，並看得出格式版本。
 */
export const PHOTO_BACKUP_APP_ID = 'bloomin-photos'
export const PHOTO_BACKUP_SCHEMA_VERSION = 1

export interface PhotoManifestEntry {
  id: string
  studentId: string
  recordDate: string
  caption: string
  width: number
  height: number
  createdAt: string
  /** zip 內原圖的路徑 */
  file: string
  /** zip 內縮圖的路徑；一併備份，還原後不必在手機上重新解碼原圖產生縮圖 */
  thumbFile: string
}

/**
 * 這份備份裝的是哪些照片：某位學生，或所屬學生不在目前資料中的「未歸屬」照片。
 * 只是給人看與日後辨識用；匯入端不依賴它（舊版的全部照片備份沒有這個欄位也能匯入），
 * 所以加這個欄位不提升 schemaVersion —— 提升反而會讓舊版 App 拒絕新檔。
 */
export type PhotoBackupScope =
  | { kind: 'student'; studentId: string; studentName: string }
  | { kind: 'unassigned' }

export interface PhotoManifest {
  app: typeof PHOTO_BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  scope: PhotoBackupScope
  photos: PhotoManifestEntry[]
}

/** 檔名含學生姓名（或「未歸屬」）與日期時間：一眼看得出是誰的，同一天多次備份也不會互相覆蓋。 */
export function photoBackupFileName(now: Date, scope: PhotoBackupScope): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  // 這些字元在 iOS「檔案」、Windows 或 zip 工具裡不能出現在檔名中，換成底線，姓名其餘部分照留
  const who = scope.kind === 'student' ? scope.studentName.replace(/[/\\:*?"<>|]/g, '_') : '未歸屬'
  return `bloomin-照片備份-${who}-${y}${m}${d}-${hh}${mm}.zip`
}

/**
 * 把一份照片打包成 zip（純函式：不讀資料庫、不送出、不記時間）。
 * 送出與記錄備份時間在畫面層，與資料備份的 buildBackup／BackupPanel 同一種分工。
 */
export async function buildPhotoBackup(
  photos: readonly Photo[],
  now: Date,
  scope: PhotoBackupScope,
): Promise<File> {
  const files: Zippable = {}
  const entries: PhotoManifestEntry[] = []
  for (const p of photos) {
    const file = `photos/${p.id}.jpg`
    const thumbFile = `thumbs/${p.id}.jpg`
    files[file] = new Uint8Array(await p.blob.arrayBuffer())
    files[thumbFile] = new Uint8Array(await p.thumb.arrayBuffer())
    entries.push({
      id: p.id,
      studentId: p.studentId,
      recordDate: p.recordDate,
      caption: p.caption,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
      file,
      thumbFile,
    })
  }
  const manifest: PhotoManifest = {
    app: PHOTO_BACKUP_APP_ID,
    schemaVersion: PHOTO_BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    scope,
    photos: entries,
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  // 照片已是 JPEG，再壓縮幾乎沒有效果，只會多花時間：level 0 即 store 模式
  const zip = zipSync(files, { level: 0 })
  return new File([zip], photoBackupFileName(now, scope), { type: 'application/zip' })
}

export function describeExport(outcome: ShareOutcome): string {
  switch (outcome) {
    case 'cancelled':
      return '已取消，這次沒有備份照片。'
    case 'shared':
      return '已送出照片備份。請確認它真的存到了「檔案」或 iCloud Drive。'
    case 'downloaded':
      return '已下載照片備份。'
  }
}

export type PhotoImportResult =
  | {
      ok: true
      added: number
      /** 本機已有同 id 的照片而略過 —— 重複匯入同一份備份不會產生重複 */
      skippedExisting: number
      /** manifest 有列、zip 裡卻沒有圖檔而略過的張數 */
      missingFile: number
      /** 空間不足而中止時，還沒匯入的張數（重新匯入同一份會跳過已存在的，可接續） */
      noSpace: number
      /** 新增的照片中，所屬學生目前不在資料裡的張數（照樣存入，還原資料備份後就會出現） */
      orphaned: number
    }
  | { ok: false; error: string }

/**
 * 匯入照片備份：只做合併，絕不覆蓋本機既有的照片。
 */
export async function importPhotoBackup(
  zipFile: Blob,
  knownStudentIds: ReadonlySet<string>,
): Promise<PhotoImportResult> {
  const parsed = await parsePhotoBackup(zipFile)
  if (!parsed.ok) return parsed
  const { files, manifest } = parsed
  const db = await getDb()
  let added = 0
  let skippedExisting = 0
  let orphaned = 0
  let missingFile = 0
  let noSpace = 0
  for (const [i, entry] of manifest.photos.entries()) {
    // 本機版本可能在匯出後被編輯過，備份不能把它蓋回舊的
    if ((await db.getKey(PHOTOS_STORE, entry.id)) !== undefined) {
      skippedExisting++
      continue
    }
    // 路徑已在 entryProblem 限定為 photos/、thumbs/ 開頭；原型鏈上沒有含 '/' 的屬性，直接索引即可
    const blobBytes = files[entry.file]
    const thumbBytes = files[entry.thumbFile]
    // 少了圖檔就不是一張完整的照片：略過這張，不留下殘缺紀錄，其他照常匯入
    if (!blobBytes || !thumbBytes) {
      missingFile++
      continue
    }
    const photo: Photo = {
      id: entry.id,
      studentId: entry.studentId,
      recordDate: entry.recordDate,
      caption: entry.caption,
      blob: jpeg(blobBytes),
      thumb: jpeg(thumbBytes),
      width: entry.width,
      height: entry.height,
      createdAt: entry.createdAt,
    }
    try {
      await putPhoto(photo)
    } catch (err) {
      if (!isQuotaError(err)) throw err
      // 空間滿了，後面的也存不進去；已匯入的保留，回報剩幾張
      noSpace = manifest.photos.length - i
      break
    }
    added++
    // 不丟棄：使用者可能先匯入照片、後還原資料備份，順序不該決定照片的去留
    if (!knownStudentIds.has(entry.studentId)) orphaned++
  }
  return { ok: true, added, skippedExisting, missingFile, noSpace, orphaned }
}

type ParsedBackup =
  | { ok: true; files: Record<string, Uint8Array>; manifest: PhotoManifest }
  | { ok: false; error: string }

/**
 * 在寫入任何一張照片之前，先確認整份檔案是看得懂的 BloomIn 照片備份。
 * 沿用資料備份的原則：寧可拒絕一個其實沒問題的檔案，也不要寫進一堆看不懂的資料。
 */
async function parsePhotoBackup(zipFile: Blob): Promise<ParsedBackup> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await zipFile.arrayBuffer()))
  } catch {
    return { ok: false, error: '這不是有效的 zip 檔案，可能選錯檔案或檔案已損壞。' }
  }
  const manifestBytes = files['manifest.json']
  if (!manifestBytes) {
    return { ok: false, error: '這不是 BloomIn 的照片備份（缺少 manifest.json）。' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(manifestBytes))
  } catch {
    return { ok: false, error: '照片備份的 manifest.json 已損壞。' }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '照片備份的 manifest.json 不是預期的格式。' }
  }
  const manifest = raw as Partial<PhotoManifest>
  if (manifest.app !== PHOTO_BACKUP_APP_ID) {
    return { ok: false, error: '這不是 BloomIn 的照片備份。' }
  }
  if (typeof manifest.schemaVersion !== 'number') {
    return { ok: false, error: '照片備份缺少版本資訊，無法確認相容性。' }
  }
  if (manifest.schemaVersion > PHOTO_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `這個照片備份來自較新版本的 App（格式 v${manifest.schemaVersion}，目前支援到 v${PHOTO_BACKUP_SCHEMA_VERSION}）。請先更新 App。`,
    }
  }
  if (!Array.isArray(manifest.photos)) {
    return { ok: false, error: '照片備份的照片清單已損壞，為了避免寫入殘缺資料而中止。' }
  }
  // 逐筆驗證要在寫入第一張之前做完：任何一筆看不懂就整份拒絕，不留下「寫了一半」的匯入
  for (const [i, entry] of (manifest.photos as unknown[]).entries()) {
    const problem = entryProblem(entry)
    if (problem !== null) {
      return {
        ok: false,
        error: `照片備份的第 ${i + 1} 筆資料${problem}，為了避免寫入殘缺資料而整份中止。`,
      }
    }
  }
  return { ok: true, files, manifest: manifest as PhotoManifest }
}

/**
 * manifest 單筆項目的結構檢查，對應 photos store 的 not null 欄位。
 * 回傳問題描述，沒問題回傳 null。
 */
function entryProblem(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return '不是預期的格式'
  const e = entry as Record<string, unknown>
  if (!isNonEmptyString(e.id)) return '缺少有效的 id'
  if (!isNonEmptyString(e.studentId)) return '缺少有效的學生 id'
  if (typeof e.recordDate !== 'string' || !isRealDate(e.recordDate)) {
    return '的紀錄日期格式不對'
  }
  if (typeof e.caption !== 'string') return '的說明欄位損壞'
  if (typeof e.createdAt !== 'string' || !isAppIsoTimestamp(e.createdAt)) return '的建立時間欄位損壞'
  if (!isPositiveInteger(e.width) || !isPositiveInteger(e.height)) return '的尺寸欄位損壞'
  // 路徑限定在各自的目錄：擋下指向 manifest.json 的項目，也讓 'constructor' 之類的
  // 原型鏈屬性名（都不含 '/'）不可能被當成 zip 裡的檔案讀出來
  if (typeof e.file !== 'string' || !e.file.startsWith('photos/')) return '的原圖路徑不對'
  if (typeof e.thumbFile !== 'string' || !e.thumbFile.startsWith('thumbs/')) return '的縮圖路徑不對'
  return null
}

/** YYYY-MM-DD 且是日曆上真的存在的日期；Date 會把 2023-02-29 默默進位成 3/1，所以要比回原值。 */
function isRealDate(iso: string): boolean {
  const d = parseISODate(iso)
  return d !== null && toISODate(d) === iso
}

/**
 * 只接受 App 自己寫出的格式（Date.prototype.toISOString 的輸出，UTC、含毫秒）。
 * 列表同日排序直接比較這個字串；混入時區位移或少了毫秒的寫法，字串順序就不等於時間順序。
 * 用「解析後再轉回來必須一模一樣」判斷，比任何正規表示式都不會漏掉溢位或格式差異。
 */
function isAppIsoTimestamp(v: string): boolean {
  const t = new Date(v)
  return !Number.isNaN(t.getTime()) && t.toISOString() === v
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}


function jpeg(bytes: Uint8Array): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
}

export function describeImport(r: PhotoImportResult): string {
  if (!r.ok) return r.error
  if (r.noSpace > 0) {
    return `裝置儲存空間不足，已匯入 ${r.added} 張、${r.noSpace} 張因空間不足未匯入。清出空間後重新匯入同一份備份，會從沒匯入的部分接續。`
  }
  const parts = [`已匯入：新增 ${r.added} 張`]
  if (r.skippedExisting > 0) parts.push(`略過 ${r.skippedExisting} 張已存在`)
  if (r.missingFile > 0) parts.push(`略過 ${r.missingFile} 張檔案缺失`)
  let text = `${parts.join('、')}。`
  if (r.orphaned > 0) {
    text += `其中 ${r.orphaned} 張屬於目前找不到的學生，還原對應的資料備份後就會出現。`
  }
  return text
}
