import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_CSV_HEADERS,
  attendanceCsvRows,
  buildStatements,
  summaryCsvRows,
} from './reports'
import type { AppState, Attendance, CourseType, Session, Student } from './types'

const sketch: CourseType = {
  id: 'ct1',
  name: '素描',
  hourlyRate: 500,
  chargeOnAbsence: false,
  accent: 'terracotta',
  archived: false,
}

const mei: Student = {
  id: 'st1',
  name: '陳小美',
  phone: '0912-111-111',
  guardianName: '',
  guardianPhone: '',
  hourlyRateOverride: null,
  courseTypeIds: ['ct1'],
  note: '',
  archived: false,
  createdAt: '2026-07-01T00:00:00.000Z',
}

const wei: Student = { ...mei, id: 'st2', name: '林大衛', phone: '0912-222-222' }

function session(id: string, date: string, topic: string): Session {
  return {
    id,
    date,
    startTime: '16:00',
    endTime: '18:00',
    courseTypeId: 'ct1',
    topic,
    note: '',
    rosterStudentIds: ['st1', 'st2'],
  }
}

function attendance(over: Partial<Attendance> & Pick<Attendance, 'id' | 'sessionId' | 'studentId'>): Attendance {
  return {
    status: 'present',
    actualStart: null,
    actualEnd: null,
    billedMinutes: 120,
    appliedRate: 500,
    amount: 1000,
    manualAmountOverride: null,
    note: '',
    ...over,
  }
}

function fixture(): AppState {
  return {
    schemaVersion: 1,
    settings: {
      studioName: '小花美術教室',
      teacherName: '王老師',
      defaultHourlyRate: 500,
      rounding: 'nearest15',
      backupReminderDays: 7,
      lastBackupAt: null,
    },
    courseTypes: [sketch],
    students: [mei, wei],
    sessions: [session('s2', '2026-08-11', '靜物'), session('s1', '2026-08-04', '石膏像')],
    attendances: [
      attendance({ id: 'a1', sessionId: 's1', studentId: 'st1' }),
      attendance({ id: 'a2', sessionId: 's1', studentId: 'st2' }),
      attendance({ id: 'a3', sessionId: 's2', studentId: 'st1' }),
      attendance({
        id: 'a4',
        sessionId: 's2',
        studentId: 'st2',
        status: 'excused',
        billedMinutes: 0,
        amount: 0,
        note: '家庭旅遊',
      }),
    ],
  }
}

describe('月結單', () => {
  it('每位學生一份，依姓名排序', () => {
    const out = buildStatements(fixture(), '2026-08')
    expect(out.map((s) => s.student.name)).toEqual(['林大衛', '陳小美'])
  })

  it('明細依日期由舊到新排列', () => {
    const [, meiStatement] = buildStatements(fixture(), '2026-08')
    expect(meiStatement!.lines.map((l) => l.date)).toEqual(['2026-08-04', '2026-08-11'])
  })

  it('合計來自出席紀錄的金額', () => {
    const [weiStatement, meiStatement] = buildStatements(fixture(), '2026-08')
    expect(meiStatement!.totalAmount).toBe(2000)
    expect(meiStatement!.totalMinutes).toBe(240)
    expect(weiStatement!.totalAmount).toBe(1000)
  })

  it('請假仍列在明細上，金額為 0', () => {
    // 家長要看得到那天有課但請假了，而不是那一列整個消失
    const [weiStatement] = buildStatements(fixture(), '2026-08')
    const excused = weiStatement!.lines.find((l) => l.status === 'excused')
    expect(excused).toBeDefined()
    expect(excused!.amount).toBe(0)
    expect(weiStatement!.presentCount).toBe(1)
  })

  it('沿用紀錄上的費率快照，不依現行費率重算', () => {
    // 這是月結單的核心：半年後調漲學費，去年寄出的帳單金額必須原封不動
    const d = fixture()
    d.attendances[0] = attendance({
      id: 'a1',
      sessionId: 's1',
      studentId: 'st1',
      appliedRate: 300,
      amount: 600,
    })
    d.courseTypes[0] = { ...sketch, hourlyRate: 900 }

    const [, meiStatement] = buildStatements(d, '2026-08')
    const line = meiStatement!.lines[0]!
    expect(line.rate).toBe(300)
    expect(line.amount).toBe(600)
    expect(meiStatement!.totalAmount).toBe(1600)
  })

  it('只取指定學生', () => {
    const out = buildStatements(fixture(), '2026-08', ['st1'])
    expect(out).toHaveLength(1)
    expect(out[0]!.student.name).toBe('陳小美')
  })

  it('沒有紀錄的月份回傳空陣列', () => {
    expect(buildStatements(fixture(), '2026-09')).toEqual([])
  })
})

describe('CSV 匯出', () => {
  it('明細每列的欄數與表頭一致', () => {
    const rows = attendanceCsvRows(fixture(), '2026-08')
    expect(rows).toHaveLength(4)
    for (const row of rows) expect(row).toHaveLength(ATTENDANCE_CSV_HEADERS.length)
  })

  it('明細帶出實際起訖時間，未調整時填課堂時間', () => {
    const d = fixture()
    d.attendances[0] = attendance({
      id: 'a1',
      sessionId: 's1',
      studentId: 'st1',
      actualEnd: '17:00',
      billedMinutes: 60,
      amount: 500,
    })
    const row = attendanceCsvRows(d, '2026-08')[0]!
    expect(row).toContain('16:00')
    expect(row).toContain('17:00')
    expect(row).toContain('500')
  })

  it('彙總每位學生一列', () => {
    const rows = summaryCsvRows(fixture(), '2026-08')
    expect(rows.map((r) => r[0])).toEqual(['林大衛', '陳小美'])
    expect(rows.find((r) => r[0] === '陳小美')).toEqual(['陳小美', '0912-111-111', '2', '4 小時', '2000'])
  })
})
