import type {
  Attendance,
  CourseType,
  Rounding,
  Session,
  Settings,
  Student,
} from './types'

/** 一堂課單一學生的計費輸入。只取計費真正需要的欄位，避免呼叫端被迫湊出完整物件。 */
export interface BillingInput {
  attendance: Pick<Attendance, 'status' | 'actualStart' | 'actualEnd' | 'manualAmountOverride'>
  session: Pick<Session, 'startTime' | 'endTime'>
  student: Pick<Student, 'hourlyRateOverride'>
  /** 找不到對應課程類型時（例如類型已被刪除）傳 null，費率會退到預設值。 */
  courseType: Pick<CourseType, 'hourlyRate' | 'chargeOnAbsence'> | null
  settings: Pick<Settings, 'defaultHourlyRate' | 'rounding'>
}

export interface BillingResult {
  billedMinutes: number
  appliedRate: number
  amount: number
}

/** 'HH:mm' 轉成當日分鐘數；格式不合法回傳 null。 */
export function parseTime(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} 分`
  if (m === 0) return `${h} 小時`
  return `${h} 小時 ${m} 分`
}

/**
 * 檢查時間區間是否可用於計費，供表單在存檔前擋下錯誤輸入。
 * 回傳錯誤訊息，或 null 表示通過。
 *
 * 刻意不支援跨午夜：美術課不會上到隔天，把 end < start 自動加 24 小時
 * 只會把打錯的時間變成一筆天價帳單。
 */
export function validateTimeWindow(start: string, end: string): string | null {
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === null) return '開始時間格式不正確'
  if (e === null) return '結束時間格式不正確'
  if (e <= s) return '結束時間必須晚於開始時間'
  return null
}

/**
 * 費率解析，先命中先用：
 * 學生個別覆寫 → 課程類型費率 → 全域預設值。
 *
 * 用 `??` 而非 `||`，因為 0 是合法費率（免費生），不該被當成未設定。
 */
export function resolveRate(
  student: Pick<Student, 'hourlyRateOverride'>,
  courseType: Pick<CourseType, 'hourlyRate'> | null,
  settings: Pick<Settings, 'defaultHourlyRate'>,
): number {
  return student.hourlyRateOverride ?? courseType?.hourlyRate ?? settings.defaultHourlyRate
}

/** 依進位規則調整計費分鐘數。nearest 為四捨五入，遲到 5 分鐘不會被當成半小時。 */
export function roundMinutes(minutes: number, rounding: Rounding): number {
  switch (rounding) {
    case 'exact':
      return minutes
    case 'nearest15':
      return Math.round(minutes / 15) * 15
    case 'nearest30':
      return Math.round(minutes / 30) * 30
  }
}

/**
 * 計算一筆出席紀錄的時數與金額。
 *
 * 純函式，無副作用。結果應寫回 Attendance 的快照欄位，之後不再重算。
 */
export function computeBilling(input: BillingInput): BillingResult {
  const { attendance, student, courseType, settings } = input
  const appliedRate = resolveRate(student, courseType, settings)

  const billedMinutes = resolveBilledMinutes(input)

  // 手動指定金額凌駕一切費率計算，但時數仍照算，統計報表才看得到實際上課時間。
  const amount =
    attendance.manualAmountOverride ?? Math.round((billedMinutes / 60) * appliedRate)

  return { billedMinutes, appliedRate, amount }
}

function resolveBilledMinutes(input: BillingInput): number {
  const { attendance, session, courseType, settings } = input

  if (attendance.status === 'excused') {
    // 事先請假一律不計費，不受 chargeOnAbsence 影響 —— 這正是它與 absent 的差別。
    return 0
  }

  if (attendance.status === 'absent') {
    if (!courseType?.chargeOnAbsence) return 0
    // 人沒到，沒有「實際時間」可用，因此照該堂課排定的長度收費。
    return roundMinutes(spanMinutes(session.startTime, session.endTime), settings.rounding)
  }

  // present / late：以實際起訖時間為準，未填則沿用該堂課的排定時間。
  const start = attendance.actualStart ?? session.startTime
  const end = attendance.actualEnd ?? session.endTime
  return roundMinutes(spanMinutes(start, end), settings.rounding)
}

/** 區間長度（分鐘）。時間不合法或結束不晚於開始時回傳 0，避免產出負數或天價金額。 */
function spanMinutes(start: string, end: string): number {
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === null || e === null || e <= s) return 0
  return e - s
}
