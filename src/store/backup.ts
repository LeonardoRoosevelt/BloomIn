import { SCHEMA_VERSION, type AppState } from '../domain/types'

/**
 * 備份檔格式。
 *
 * 外層刻意包一層信封而不是直接倒出 AppState：匯入時要能分辨「這是 BloomIn 的備份」
 * 與「這是某個剛好也是 JSON 的檔案」，並且要看得出它來自哪個 schema 版本。
 * 少了這層，選錯檔案就會直接把資料洗掉。
 */
export interface BackupFile {
  app: 'bloomin'
  schemaVersion: number
  exportedAt: string
  state: AppState
}

export const BACKUP_APP_ID = 'bloomin'

export function buildBackup(state: AppState, now: Date): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    state,
  }
}

export function backupFileName(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `bloomin-備份-${y}${m}${d}-${hh}${mm}.json`
}

export type ParseResult =
  | { ok: true; state: AppState; exportedAt: string }
  | { ok: false; error: string }

/**
 * 解析備份檔內容。
 *
 * 每一道檢查都是為了擋下「匯入後資料被洗掉」：寧可拒絕一個其實沒問題的檔案，
 * 也不能接受一個結構不對的檔案然後把現有資料覆蓋成殘缺狀態。
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '這不是有效的 JSON 檔案。' }
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '檔案內容不是預期的格式。' }
  }
  const file = raw as Partial<BackupFile>

  if (file.app !== BACKUP_APP_ID) {
    return { ok: false, error: '這不是 BloomIn 的備份檔。' }
  }
  if (typeof file.schemaVersion !== 'number') {
    return { ok: false, error: '備份檔缺少版本資訊，無法確認相容性。' }
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `這個備份來自較新版本的 App（格式 v${file.schemaVersion}，目前支援到 v${SCHEMA_VERSION}）。請先更新 App。`,
    }
  }

  const state = file.state
  if (typeof state !== 'object' || state === null) {
    return { ok: false, error: '備份檔沒有資料內容。' }
  }
  for (const key of ['courseTypes', 'students', 'sessions', 'attendances'] as const) {
    if (!Array.isArray(state[key])) {
      return { ok: false, error: `備份檔的「${key}」欄位損壞，為了避免覆蓋掉現有資料而中止。` }
    }
  }
  if (typeof state.settings !== 'object' || state.settings === null) {
    return { ok: false, error: '備份檔的設定欄位損壞，為了避免覆蓋掉現有資料而中止。' }
  }

  return {
    ok: true,
    // schemaVersion 一律以目前版本寫回，日後若有轉換邏輯會在這裡插入
    state: { ...state, schemaVersion: SCHEMA_VERSION },
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
  }
}

/** 距離上次備份是否已超過提醒天數。從未備份過一律回傳 true。 */
export function needsBackupReminder(
  lastBackupAt: string | null,
  reminderDays: number,
  now: Date,
): boolean {
  if (lastBackupAt === null) return true
  const last = new Date(lastBackupAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last > reminderDays * 24 * 60 * 60 * 1000
}

/** 距離上次備份幾天。從未備份過回傳 null。 */
export function daysSinceBackup(lastBackupAt: string | null, now: Date): number | null {
  if (lastBackupAt === null) return null
  const last = new Date(lastBackupAt).getTime()
  if (Number.isNaN(last)) return null
  return Math.floor((now.getTime() - last) / (24 * 60 * 60 * 1000))
}
