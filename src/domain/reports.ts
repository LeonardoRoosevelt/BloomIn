import { formatMinutes } from './billing'
import { courseTypeOf, recordsInMonth, type AttendanceRecord } from './selectors'
import type { AppState, AttendanceStatus, Student } from './types'

export interface StatementLine {
  date: string
  courseName: string
  topic: string
  timeRange: string
  status: AttendanceStatus
  minutes: number
  rate: number
  amount: number
}

export interface Statement {
  student: Student
  month: string
  lines: StatementLine[]
  presentCount: number
  totalMinutes: number
  totalAmount: number
}

/**
 * 產生某月的月結單。
 *
 * 費率與金額直接取用出席紀錄上的快照，不重新計算 —— 月結單必須重現當時
 * 開出去的數字，日後調漲學費不能讓已寄出的帳單跟著改變。
 */
export function buildStatements(
  d: AppState,
  month: string,
  studentIds?: readonly string[],
): Statement[] {
  const monthRecords = recordsInMonth(d, month)
  const wanted =
    studentIds === undefined
      ? [...new Set(monthRecords.map((r) => r.attendance.studentId))]
      : studentIds

  return wanted
    .flatMap((id) => {
      const student = d.students.find((s) => s.id === id)
      if (!student) return []
      const lines = monthRecords
        .filter((r) => r.attendance.studentId === id)
        .sort(byDateThenTime)
        .map((r) => toLine(d, r))
      return [
        {
          student,
          month,
          lines,
          presentCount: lines.filter((l) => l.status === 'present' || l.status === 'late').length,
          totalMinutes: lines.reduce((n, l) => n + l.minutes, 0),
          totalAmount: lines.reduce((n, l) => n + l.amount, 0),
        },
      ]
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name, 'zh-Hant'))
}

function toLine(d: AppState, { attendance, session }: AttendanceRecord): StatementLine {
  const course = courseTypeOf(d, session)
  const start = attendance.actualStart ?? session.startTime
  const end = attendance.actualEnd ?? session.endTime
  return {
    date: session.date,
    courseName: course?.name ?? '（已刪除的課程）',
    topic: session.topic,
    timeRange: `${start}–${end}`,
    status: attendance.status,
    minutes: attendance.billedMinutes,
    rate: attendance.appliedRate,
    amount: attendance.amount,
  }
}

function byDateThenTime(a: AttendanceRecord, b: AttendanceRecord): number {
  const byDate = a.session.date.localeCompare(b.session.date)
  return byDate !== 0 ? byDate : a.session.startTime.localeCompare(b.session.startTime)
}

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遲到',
  excused: '請假',
  absent: '缺席',
}

export function statusText(status: AttendanceStatus): string {
  return STATUS_TEXT[status]
}

export const ATTENDANCE_CSV_HEADERS = [
  '日期',
  '課程開始',
  '課程結束',
  '課程類型',
  '課程內容',
  '學生',
  '狀態',
  '實際開始',
  '實際結束',
  '計費分鐘',
  '時薪',
  '金額',
  '備註',
] as const

/** 某月所有出席明細，一列一筆。 */
export function attendanceCsvRows(d: AppState, month: string): string[][] {
  return recordsInMonth(d, month)
    .sort(byDateThenTime)
    .map(({ attendance, session }) => {
      const course = courseTypeOf(d, session)
      const student = d.students.find((s) => s.id === attendance.studentId)
      return [
        session.date,
        session.startTime,
        session.endTime,
        course?.name ?? '',
        session.topic,
        student?.name ?? '',
        statusText(attendance.status),
        attendance.actualStart ?? session.startTime,
        attendance.actualEnd ?? session.endTime,
        String(attendance.billedMinutes),
        String(attendance.appliedRate),
        String(attendance.amount),
        attendance.note,
      ]
    })
}

/** 每位學生一列的月度彙總，適合直接貼進記帳試算表。 */
export const SUMMARY_CSV_HEADERS = ['學生', '電話', '出席堂數', '計費時數', '金額'] as const

export function summaryCsvRows(d: AppState, month: string): string[][] {
  return buildStatements(d, month).map((st) => [
    st.student.name,
    st.student.phone,
    String(st.presentCount),
    formatMinutes(st.totalMinutes),
    String(st.totalAmount),
  ])
}
