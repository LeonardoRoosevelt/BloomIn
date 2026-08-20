import type { AppState, Attendance, CourseType, Session, Student } from './types'

/** 依日期取當天的課，並按開始時間排序。 */
export function sessionsOnDate(d: AppState, date: string): Session[] {
  return d.sessions
    .filter((s) => s.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function courseTypeOf(d: AppState, session: Session): CourseType | null {
  return d.courseTypes.find((c) => c.id === session.courseTypeId) ?? null
}

export function studentById(d: AppState, id: string): Student | null {
  return d.students.find((s) => s.id === id) ?? null
}

export function attendancesOfSession(d: AppState, sessionId: string): Attendance[] {
  return d.attendances.filter((a) => a.sessionId === sessionId)
}

export function attendanceOf(
  d: AppState,
  sessionId: string,
  studentId: string,
): Attendance | null {
  return (
    d.attendances.find((a) => a.sessionId === sessionId && a.studentId === studentId) ?? null
  )
}

export interface SessionTotals {
  /** 名單人數 */
  rosterCount: number
  /** 已點名人數（有出席紀錄者） */
  markedCount: number
  presentCount: number
  totalMinutes: number
  totalAmount: number
}

/**
 * 一堂課的結算摘要。
 *
 * 名單上「沒有出席紀錄」的學生一律不計入任何統計 —— 未點名不等於出席，
 * 讓報表憑空生出出席紀錄會直接算錯錢。
 */
export function sessionTotals(d: AppState, session: Session): SessionTotals {
  const records = attendancesOfSession(d, session.id)
  const roster = new Set(session.rosterStudentIds)
  // 只計名單內的紀錄，避免學生被移出名單後金額還留在小計裡
  const inRoster = records.filter((a) => roster.has(a.studentId))
  return {
    rosterCount: session.rosterStudentIds.length,
    markedCount: inRoster.length,
    presentCount: inRoster.filter((a) => a.status === 'present' || a.status === 'late').length,
    totalMinutes: inRoster.reduce((n, a) => n + a.billedMinutes, 0),
    totalAmount: inRoster.reduce((n, a) => n + a.amount, 0),
  }
}

/* ── 學生視角 ───────────────────────────────── */

export interface AttendanceRecord {
  attendance: Attendance
  session: Session
}

/**
 * 某位學生的所有出席紀錄，附上所屬課堂，日期新到舊排序。
 *
 * 只取「學生仍在該堂名單內」的紀錄，與 sessionTotals 的口徑一致 ——
 * 否則被移出名單的人，其金額會在課堂小計裡消失卻仍出現在個人帳上。
 */
export function attendancesOfStudent(d: AppState, studentId: string): AttendanceRecord[] {
  const sessions = new Map(d.sessions.map((s) => [s.id, s]))
  return d.attendances
    .filter((a) => a.studentId === studentId)
    .flatMap((attendance) => {
      const session = sessions.get(attendance.sessionId)
      if (!session) return []
      if (!session.rosterStudentIds.includes(studentId)) return []
      return [{ attendance, session }]
    })
    .sort((a, b) => {
      const byDate = b.session.date.localeCompare(a.session.date)
      return byDate !== 0 ? byDate : b.session.startTime.localeCompare(a.session.startTime)
    })
}

export interface PeriodTotals {
  /** 有出席紀錄的堂數（含請假與缺席） */
  recordCount: number
  presentCount: number
  minutes: number
  amount: number
}

export function totalsOf(records: readonly AttendanceRecord[]): PeriodTotals {
  return {
    recordCount: records.length,
    presentCount: records.filter(
      (r) => r.attendance.status === 'present' || r.attendance.status === 'late',
    ).length,
    minutes: records.reduce((n, r) => n + r.attendance.billedMinutes, 0),
    amount: records.reduce((n, r) => n + r.attendance.amount, 0),
  }
}

/** 依月份分組，新到舊。 */
export function groupByMonth(
  records: readonly AttendanceRecord[],
): { month: string; records: AttendanceRecord[] }[] {
  const map = new Map<string, AttendanceRecord[]>()
  for (const r of records) {
    const key = r.session.date.slice(0, 7)
    const bucket = map.get(key)
    if (bucket) bucket.push(r)
    else map.set(key, [r])
  }
  return [...map.entries()]
    .map(([month, recs]) => ({ month, records: recs }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

/* ── 課表視角 ───────────────────────────────── */

/** 某月（'YYYY-MM'）的所有課，依日期與開始時間排序。 */
export function sessionsInMonth(d: AppState, month: string): Session[] {
  return d.sessions
    .filter((s) => s.date.startsWith(month))
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date)
      return byDate !== 0 ? byDate : a.startTime.localeCompare(b.startTime)
    })
}
