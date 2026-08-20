import { useMemo, useState, type CSSProperties } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { Easel } from '../components/illustrations/Easel'
import { SessionCard } from '../components/SessionCard'
import { SessionForm } from '../components/SessionForm'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../components/icons'
import { formatMinutes } from '../domain/billing'
import { courseTypeOf, sessionTotals, sessionsInMonth } from '../domain/selectors'
import type { AppState, Session } from '../domain/types'
import { accentVar } from '../lib/accent'
import { formatDateLong, todayISO } from '../lib/date'
import { formatMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './Calendar.module.css'

const WEEK = ['日', '一', '二', '三', '四', '五', '六'] as const
/** 一格最多畫幾顆點，超過就不再增加，避免格子被塞爆 */
const MAX_DOTS = 3

export function Calendar() {
  const data = useStore((st) => st.data)
  const today = todayISO()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [creating, setCreating] = useState(false)

  const monthSessions = useMemo(() => sessionsInMonth(data, month), [data, month])

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const session of monthSessions) {
      const bucket = map.get(session.date)
      if (bucket) bucket.push(session)
      else map.set(session.date, [session])
    }
    return map
  }, [monthSessions])

  const monthTotal = useMemo(
    () =>
      monthSessions.reduce(
        (acc, session) => {
          const t = sessionTotals(data, session)
          return { minutes: acc.minutes + t.totalMinutes, amount: acc.amount + t.totalAmount }
        },
        { minutes: 0, amount: 0 },
      ),
    [data, monthSessions],
  )

  const [year, mon] = month.split('-').map(Number) as [number, number]

  function shiftMonth(delta: number) {
    const d = new Date(year, mon - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const daySessions = byDate.get(selected) ?? []

  return (
    <>
      <ScreenHeader
        title="課表"
        actions={
          <Button iconOnly aria-label="新增課程" onClick={() => setCreating(true)}>
            <IconPlus size={22} />
          </Button>
        }
      />

      <div className={s.split}>
        <section>
          <div className={s.monthBar}>
            <Button variant="ghost" iconOnly aria-label="上個月" onClick={() => shiftMonth(-1)}>
              <IconChevronLeft size={20} />
            </Button>
            <span className={s.monthLabel}>
              {year} 年 {mon} 月
            </span>
            <Button variant="ghost" iconOnly aria-label="下個月" onClick={() => shiftMonth(1)}>
              <IconChevronRight size={20} />
            </Button>
          </div>

          <MonthGrid
            data={data}
            month={month}
            today={today}
            selected={selected}
            byDate={byDate}
            onSelect={setSelected}
          />

          {monthSessions.length > 0 && (
            <div className={s.monthSummary}>
              <span>
                本月 <strong>{monthSessions.length}</strong> 堂
              </span>
              <span>
                計費 <strong>{formatMinutes(monthTotal.minutes)}</strong>
              </span>
              <span>
                合計 <strong>{formatMoney(monthTotal.amount)}</strong>
              </span>
            </div>
          )}
        </section>

        <section>
          <div className={s.dayHead}>{formatDateLong(selected)}</div>

          {daySessions.length === 0 ? (
            <EmptyState
              art={<Easel size={72} />}
              title="這天沒有課"
              action={<Button onClick={() => setCreating(true)}>新增課程</Button>}
            />
          ) : (
            <div className={s.dayList}>
              {daySessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </div>

      <SessionForm
        open={creating}
        session={null}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate({ name: 'session', id })}
      />
    </>
  )
}

function MonthGrid({
  data,
  month,
  today,
  selected,
  byDate,
  onSelect,
}: {
  data: AppState
  month: string
  today: string
  selected: string
  byDate: Map<string, Session[]>
  onSelect: (date: string) => void
}) {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  const firstWeekday = new Date(year, mon - 1, 1).getDay()
  // 第 0 天等於上個月的最後一天，藉此取得本月天數
  const daysInMonth = new Date(year, mon, 0).getDate()

  return (
    <div className={s.grid}>
      <div className={s.weekHead}>
        {WEEK.map((w) => (
          <div key={w} className={s.weekName}>
            {w}
          </div>
        ))}
      </div>
      <div className={s.days}>
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} className={`${s.day} ${s.blank}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const date = `${month}-${String(day).padStart(2, '0')}`
          const sessions = byDate.get(date) ?? []
          return (
            <button
              key={date}
              type="button"
              aria-label={`${mon} 月 ${day} 日，${sessions.length} 堂課`}
              aria-pressed={date === selected}
              className={[s.day, date === today && s.today, date === selected && s.selected]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(date)}
            >
              <span>{day}</span>
              <span className={s.dots}>
                {sessions.slice(0, MAX_DOTS).map((session) => {
                  const course = courseTypeOf(data, session)
                  return (
                    <span
                      key={session.id}
                      className={s.dot}
                      style={
                        {
                          '--dot-color': course
                            ? accentVar(course.accent)
                            : 'var(--text-tertiary)',
                        } as CSSProperties
                      }
                    />
                  )
                })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
