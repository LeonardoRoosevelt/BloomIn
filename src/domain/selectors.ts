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
