import type { CSSProperties } from 'react'
import { Pill } from './ui/Pill'
import { IconClock, IconStudents } from './icons'
import { formatMinutes } from '../domain/billing'
import { courseTypeOf, sessionTotals } from '../domain/selectors'
import type { Session } from '../domain/types'
import { accentVar } from '../lib/accent'
import { formatDate } from '../lib/date'
import { formatMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './SessionCard.module.css'

/** 課程摘要卡。今日與課表兩個畫面共用，確保同一堂課在哪裡看都長一樣。 */
export function SessionCard({
  session,
  showDate = false,
}: {
  session: Session
  showDate?: boolean
}) {
  const data = useStore((st) => st.data)
  const course = courseTypeOf(data, session)
  const totals = sessionTotals(data, session)
  const allMarked = totals.markedCount === totals.rosterCount

  return (
    <button
      type="button"
      className={s.card}
      style={
        { '--card-accent': course ? accentVar(course.accent) : 'var(--border)' } as CSSProperties
      }
      onClick={() => navigate({ name: 'session', id: session.id })}
    >
      <div className={s.top}>
        <span className={s.time}>
          {session.startTime}–{session.endTime}
        </span>
        {showDate && <span className={s.date}>{formatDate(session.date)}</span>}
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
}
