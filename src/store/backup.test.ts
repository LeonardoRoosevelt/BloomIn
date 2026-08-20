import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  buildBackup,
  daysSinceBackup,
  needsBackupReminder,
  parseBackup,
} from './backup'
import { SCHEMA_VERSION, createInitialState } from '../domain/types'

const NOW = new Date('2026-08-20T14:30:00+08:00')

function validBackupText(): string {
  return JSON.stringify(buildBackup(createInitialState(), NOW))
}

describe('備份匯出', () => {
  it('信封包含 App 識別、schema 版本與時間', () => {
    const b = buildBackup(createInitialState(), NOW)
    expect(b.app).toBe('bloomin')
    expect(b.schemaVersion).toBe(SCHEMA_VERSION)
    expect(b.exportedAt).toBe(NOW.toISOString())
  })

  it('檔名含日期時間，同一天多次備份不會互相覆蓋', () => {
    const a = backupFileName(NOW)
    const b = backupFileName(new Date('2026-08-20T16:45:00+08:00'))
    expect(a).not.toBe(b)
    expect(a.endsWith('.json')).toBe(true)
  })
})

describe('備份匯入的把關', () => {
  // 這些檢查全都是為了同一件事：不能讓一個結構不對的檔案覆蓋掉現有資料

  it('完整往返後資料一致', () => {
    const original = createInitialState()
    const result = parseBackup(JSON.stringify(buildBackup(original, NOW)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.courseTypes).toEqual(original.courseTypes)
    expect(result.state.settings).toEqual(original.settings)
  })

  it('拒絕不是 JSON 的檔案', () => {
    const r = parseBackup('這是一張照片，不是備份')
    expect(r.ok).toBe(false)
  })

  it('拒絕其他 App 的 JSON', () => {
    const r = parseBackup(JSON.stringify({ app: 'someotherapp', state: {} }))
    expect(r).toEqual({ ok: false, error: '這不是 BloomIn 的備份檔。' })
  })

  it('拒絕來自較新版本的備份，而不是硬吃下去', () => {
    // 靜默接受未來格式，等於用一份看不懂的資料覆蓋掉現有的
    const r = parseBackup(
      JSON.stringify({ app: 'bloomin', schemaVersion: SCHEMA_VERSION + 1, state: createInitialState() }),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('較新版本')
  })

  it('拒絕缺少集合欄位的備份', () => {
    const broken = JSON.parse(validBackupText()) as { state: Record<string, unknown> }
    delete broken.state.students
    const r = parseBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('students')
  })

  it('拒絕集合欄位型別錯誤的備份', () => {
    const broken = JSON.parse(validBackupText()) as { state: Record<string, unknown> }
    broken.state.attendances = { not: 'an array' }
    const r = parseBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
  })

  it('拒絕設定欄位損壞的備份', () => {
    const broken = JSON.parse(validBackupText()) as { state: Record<string, unknown> }
    broken.state.settings = null
    const r = parseBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
  })

  it('空的但結構完整的備份是合法的（例如剛裝好就備份）', () => {
    const empty = {
      app: 'bloomin',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: NOW.toISOString(),
      state: { schemaVersion: SCHEMA_VERSION, settings: {}, courseTypes: [], students: [], sessions: [], attendances: [] },
    }
    expect(parseBackup(JSON.stringify(empty)).ok).toBe(true)
  })
})

describe('備份提醒', () => {
  it('從未備份過就要提醒', () => {
    expect(needsBackupReminder(null, 7, NOW)).toBe(true)
  })

  it('未超過提醒天數不提醒', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 86400_000).toISOString()
    expect(needsBackupReminder(threeDaysAgo, 7, NOW)).toBe(false)
  })

  it('超過提醒天數就要提醒', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 86400_000).toISOString()
    expect(needsBackupReminder(eightDaysAgo, 7, NOW)).toBe(true)
  })

  it('時間字串壞掉時採取提醒的一方', () => {
    // 寧可多提醒一次，也不要因為讀不懂時間就靜靜地不提醒
    expect(needsBackupReminder('not a date', 7, NOW)).toBe(true)
  })

  it('回報距今天數', () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400_000).toISOString()
    expect(daysSinceBackup(fiveDaysAgo, NOW)).toBe(5)
    expect(daysSinceBackup(null, NOW)).toBeNull()
  })
})
