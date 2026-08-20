/** 全部日期以本地時區的 'YYYY-MM-DD' 字串處理，不存 timestamp —— 課程屬於某一天，與時區無關。 */

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 例：8/20（三） */
export function formatDate(iso: string): string {
  const d = parseISODate(iso)
  if (!d) return iso
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`
}

/** 例：2026 年 8 月 20 日（三） */
export function formatDateLong(iso: string): string {
  const d = parseISODate(iso)
  if (!d) return iso
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`
}

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  // 逐欄建構，避免 new Date('YYYY-MM-DD') 被當成 UTC 而在台灣時區差一天
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 'YYYY-MM'，月結與統計的分組鍵。 */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** 目前時間附近的整點，作為新增課程時的預設值。 */
export function defaultSessionTimes(): { startTime: string; endTime: string } {
  const now = new Date()
  const start = now.getHours()
  const hh = (h: number) => String(Math.min(h, 23)).padStart(2, '0')
  return { startTime: `${hh(start)}:00`, endTime: `${hh(start + 2)}:00` }
}

/** 'YYYY-MM' → '2026 年 8 月'。去掉前導零，避免顯示成「08 月」。 */
export function formatMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  return `${m[1]} 年 ${Number(m[2])} 月`
}
