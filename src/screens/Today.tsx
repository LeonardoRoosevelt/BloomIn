import { useState } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { Easel } from '../components/illustrations/Easel'
import { SessionForm } from '../components/SessionForm'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Pill } from '../components/ui/Pill'
import { IconClock, IconPlus, IconStudents } from '../components/icons'
import { formatMinutes } from '../domain/billing'
import { courseTypeOf, sessionTotals, sessionsOnDate } from '../domain/selectors'
import { accentVar } from '../lib/accent'
import { formatDateLong, todayISO } from '../lib/date'
import { formatMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import type { CSSProperties } from 'react'
import s from './Today.module.css'

export function Today() {
  const data = useStore((st) => st.data)
  const [creating, setCreating] = useState(false)
  const today = todayISO()
  const sessions = sessionsOnDate(data, today)

  return (
    <>
      <ScreenHeader
        title="今日"
        actions={
          <Button iconOnly aria-label="新增課程" onClick={() => setCreating(true)}>
            <IconPlus size={22} />
          </Button>
        }
      />
      <p className={s.subtitle}>{formatDateLong(today)}</p>

      {sessions.length === 0 ? (
        <EmptyState
          art={<Easel />}
          title="今天還沒有課"
          description="建立今天的課程後，就能開始點名並自動計算學費。"
          action={
            <Button onClick={() => setCreating(true)}>
              <IconPlus size={20} />
              新增課程
            </Button>
          }
        />
      ) : (
        <div className={s.list}>
          {sessions.map((session) => {
            const course = courseTypeOf(data, session)
            const totals = sessionTotals(data, session)
            const allMarked = totals.markedCount === totals.rosterCount
            return (
              <button
                key={session.id}
                type="button"
                className={s.card}
                style={
                  {
                    '--card-accent': course ? accentVar(course.accent) : 'var(--border)',
                  } as CSSProperties
                }
                onClick={() => navigate({ name: 'session', id: session.id })}
              >
                <div className={s.cardTop}>
                  <span className={s.time}>
                    {session.startTime}–{session.endTime}
                  </span>
                  <span className={s.spacer} />
                  {course && <Pill accent={course.accent}>{course.name}</Pill>}
                </div>

                <div className={`${s.topic} ${session.topic === '' ? s.topicEmpty : ''}`}>
                  {session.topic === '' ? '未填課程內容' : session.topic}
                </div>

                <div className={s.meta}>
                  <span className={`${s.metaItem} ${allMarked ? '' : s.pending}`}>
                    <IconStudents size={16} />
                    {allMarked
                      ? `${totals.presentCount}/${totals.rosterCount} 出席`
                      : `已點名 ${totals.markedCount}/${totals.rosterCount}`}
                  </span>
                  {totals.totalMinutes > 0 && (
                    <span className={s.metaItem}>
                      <IconClock size={16} />
                      {formatMinutes(totals.totalMinutes)}
                    </span>
                  )}
                  <span className={s.amount}>{formatMoney(totals.totalAmount)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <SessionForm
        open={creating}
        session={null}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate({ name: 'session', id })}
      />
    </>
  )
}
