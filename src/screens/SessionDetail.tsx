import { useState, type CSSProperties } from 'react'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { RosterSheet } from '../components/RosterSheet'
import { SessionForm } from '../components/SessionForm'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Pill } from '../components/ui/Pill'
import { SegmentedControl, type Segment } from '../components/ui/SegmentedControl'
import { IconChevronLeft, IconEdit, IconStudents } from '../components/icons'
import { formatMinutes } from '../domain/billing'
import { attendanceOf, courseTypeOf, sessionTotals, studentById } from '../domain/selectors'
import type { AttendanceStatus } from '../domain/types'
import { accentVar } from '../lib/accent'
import { formatDateLong } from '../lib/date'
import { formatMoney } from '../lib/format'
import { goBack, navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './SessionDetail.module.css'

const STATUS: readonly Segment<AttendanceStatus>[] = [
  { value: 'present', label: '出席', tone: 'var(--success)' },
  { value: 'late', label: '遲到', tone: 'var(--warning)' },
  { value: 'excused', label: '請假', tone: 'var(--text-secondary)' },
  { value: 'absent', label: '缺席', tone: 'var(--danger)' },
]

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const data = useStore((st) => st.data)
  const setAttendance = useStore((st) => st.setAttendance)

  const [editing, setEditing] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)

  const session = data.sessions.find((x) => x.id === sessionId)
  if (!session) {
    return (
      <EmptyState
        art={<IconStudents size={72} />}
        title="找不到這堂課"
        description="它可能已被刪除。"
        action={<Button onClick={() => navigate({ name: 'today' })}>回到今日</Button>}
      />
    )
  }

  const course = courseTypeOf(data, session)
  const totals = sessionTotals(data, session)
  const unmarked = totals.rosterCount - totals.markedCount
  const adjusting = adjustingId

  return (
    <>
      <div className={s.backRow}>
        <Button variant="ghost" iconOnly aria-label="返回" onClick={goBack}>
          <IconChevronLeft size={22} />
        </Button>
        <span className={s.backLabel}>返回</span>
      </div>

      <div
        className={s.head}
        style={
          { '--card-accent': course ? accentVar(course.accent) : 'var(--border)' } as CSSProperties
        }
      >
        <div className={s.headTop}>
          <span className={s.date}>{formatDateLong(session.date)}</span>
          <span className={s.spacer} />
          {course && <Pill accent={course.accent}>{course.name}</Pill>}
        </div>
        <div className={s.time}>
          {session.startTime}–{session.endTime}
        </div>
        <div className={`${s.topic} ${session.topic === '' ? s.topicEmpty : ''}`}>
          {session.topic === '' ? '未填課程內容' : session.topic}
        </div>
        {session.note !== '' && <div className={s.note}>{session.note}</div>}

        <div className={s.headActions}>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <IconEdit size={18} />
            編輯課程
          </Button>
          <Button variant="secondary" onClick={() => setRosterOpen(true)}>
            <IconStudents size={18} />
            名單（{totals.rosterCount}）
          </Button>
        </div>
      </div>

      {unmarked > 0 && totals.rosterCount > 0 && (
        <div className={s.bulk}>
          <Button
            block
            variant="secondary"
            onClick={() => {
              // 只補未點名的人，不覆蓋老師已經標好的狀態
              for (const id of session.rosterStudentIds) {
                if (!attendanceOf(data, session.id, id)) {
                  setAttendance(session.id, id, { status: 'present' })
                }
              }
            }}
          >
            將剩下 {unmarked} 人標記為出席
          </Button>
        </div>
      )}

      {totals.rosterCount === 0 ? (
        <EmptyState
          art={<IconStudents size={72} />}
          title="這堂課還沒有學生"
          description="把學生加進名單後就能開始點名。"
          action={<Button onClick={() => setRosterOpen(true)}>編輯名單</Button>}
        />
      ) : (
        <div className={s.roster}>
          {session.rosterStudentIds.map((studentId) => {
            const student = studentById(data, studentId)
            if (!student) return null
            const record = attendanceOf(data, session.id, studentId)
            const billable = record?.status === 'present' || record?.status === 'late'
            const start = record?.actualStart ?? session.startTime
            const end = record?.actualEnd ?? session.endTime
            const timeAdjusted = record?.actualStart != null || record?.actualEnd != null

            return (
              <div key={studentId} className={s.student}>
                <div className={s.studentTop}>
                  <span className={s.studentName}>{student.name}</span>
                  <span className={`${s.money} ${record ? '' : s.moneyMuted}`}>
                    {record ? formatMoney(record.amount) : '未點名'}
                  </span>
                </div>

                <SegmentedControl
                  ariaLabel={`${student.name} 出席狀態`}
                  segments={STATUS}
                  value={record?.status ?? null}
                  onChange={(status) => setAttendance(session.id, studentId, { status })}
                />

                {billable && (
                  <div className={s.timeRow}>
                    <span className={`${s.timeValue} ${timeAdjusted ? s.adjusted : ''}`}>
                      {start}–{end}
                    </span>
                    <span>· {formatMinutes(record.billedMinutes)}</span>
                    {record.manualAmountOverride != null && <span>· 手動金額</span>}
                    <button
                      type="button"
                      className={s.adjustBtn}
                      onClick={() => setAdjustingId(studentId)}
                    >
                      調整
                    </button>
                  </div>
                )}

                {record?.note !== undefined && record.note !== '' && (
                  <div className={s.rowNote}>{record.note}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totals.markedCount > 0 && (
        <div className={s.totals}>
          <div className={s.totalsRow}>
            <span>出席</span>
            <span className={s.totalsValue}>
              {totals.presentCount} / {totals.rosterCount} 人
            </span>
          </div>
          <div className={s.totalsRow}>
            <span>計費時數</span>
            <span className={s.totalsValue}>{formatMinutes(totals.totalMinutes)}</span>
          </div>
          <div className={s.totalsRow}>
            <span>本堂合計</span>
            <span className={`${s.totalsValue} ${s.grand}`}>
              {formatMoney(totals.totalAmount)}
            </span>
          </div>
        </div>
      )}

      <SessionForm open={editing} session={session} onClose={() => setEditing(false)} />
      <RosterSheet open={rosterOpen} session={session} onClose={() => setRosterOpen(false)} />
      <AttendanceSheet
        open={adjusting !== null}
        session={session}
        student={adjusting ? studentById(data, adjusting) : null}
        attendance={adjusting ? attendanceOf(data, session.id, adjusting) : null}
        onClose={() => setAdjustingId(null)}
      />
    </>
  )
}
