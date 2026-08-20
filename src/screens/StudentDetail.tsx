import { useState } from 'react'
import { StatusTag } from '../components/StatusTag'
import { StudentForm } from '../components/StudentForm'
import { Button } from '../components/ui/Button'
import { Card, Row } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Pill } from '../components/ui/Pill'
import { IconChevronLeft, IconEdit, IconPhone, IconStudents, IconUser } from '../components/icons'
import { formatMinutes } from '../domain/billing'
import {
  attendancesOfStudent,
  courseTypeOf,
  groupByMonth,
  totalsOf,
} from '../domain/selectors'
import { formatDate, formatMonth } from '../lib/date'
import { formatMoney } from '../lib/format'
import { goBack, navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './StudentDetail.module.css'

export function StudentDetail({ studentId }: { studentId: string }) {
  const data = useStore((st) => st.data)
  const updateStudent = useStore((st) => st.updateStudent)
  const [editing, setEditing] = useState(false)

  const student = data.students.find((x) => x.id === studentId)
  if (!student) {
    return (
      <EmptyState
        art={<IconStudents size={72} />}
        title="找不到這位學生"
        action={<Button onClick={() => navigate({ name: 'students' })}>回到學生列表</Button>}
      />
    )
  }

  const records = attendancesOfStudent(data, studentId)
  const total = totalsOf(records)
  const months = groupByMonth(records)

  return (
    <>
      <div className={s.backRow}>
        <Button variant="ghost" iconOnly aria-label="返回" onClick={goBack}>
          <IconChevronLeft size={22} />
        </Button>
        <span className={s.backLabel}>學生</span>
      </div>

      <h1 className={s.name}>
        {student.name}
        {student.archived && '（已封存）'}
      </h1>

      <div className={s.tags}>
        {student.courseTypeIds.map((cid) => {
          const c = data.courseTypes.find((x) => x.id === cid)
          return c ? (
            <Pill key={cid} accent={c.accent}>
              {c.name}
            </Pill>
          ) : null
        })}
      </div>

      <div className={s.contact}>
        {student.phone !== '' && (
          <div className={s.contactRow}>
            <IconPhone size={18} />
            <a className={s.phone} href={`tel:${student.phone}`} data-selectable>
              {student.phone}
            </a>
          </div>
        )}
        {student.guardianName !== '' && (
          <div className={s.contactRow}>
            <IconUser size={18} />
            <span data-selectable>{student.guardianName}</span>
            {student.guardianPhone !== '' && (
              <a className={s.phone} href={`tel:${student.guardianPhone}`} data-selectable>
                {student.guardianPhone}
              </a>
            )}
          </div>
        )}
        <div className={s.rateRow}>
          <span className={s.rateLabel}>時薪</span>
          <span>
            {student.hourlyRateOverride == null
              ? '沿用課程費率'
              : `${formatMoney(student.hourlyRateOverride)} / 小時`}
          </span>
        </div>
      </div>

      {student.note !== '' && <p className={s.note}>{student.note}</p>}

      <div className={s.actions}>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <IconEdit size={18} />
          編輯
        </Button>
        <Button
          variant="secondary"
          onClick={() => updateStudent(student.id, { archived: !student.archived })}
        >
          {student.archived ? '取消封存' : '封存'}
        </Button>
      </div>

      {/* 刻意不提供刪除：學生的出席紀錄是既有帳務的一部分，
          刪掉會讓過去的月結單對不起來。封存只是從清單隱藏。 */}

      <div className={s.stats} style={{ marginTop: 'var(--sp-5)' }}>
        <div className={s.stat}>
          <div className={s.statValue}>{total.presentCount}</div>
          <div className={s.statLabel}>出席堂數</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>{(total.minutes / 60).toFixed(1)}</div>
          <div className={s.statLabel}>累計時數</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>{total.amount.toLocaleString('zh-TW')}</div>
          <div className={s.statLabel}>累計金額</div>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          art={<IconStudents size={64} />}
          title="還沒有出席紀錄"
          description="在課堂點名後，這裡會依月份列出明細。"
        />
      ) : (
        months.map(({ month, records: monthRecords }) => {
          const sum = totalsOf(monthRecords)
          return (
            <div key={month}>
              <div className={s.monthHead}>
                <span className={s.monthLabel}>{formatMonth(month)}</span>
                <span className={s.monthSum}>
                  {formatMinutes(sum.minutes)}　{formatMoney(sum.amount)}
                </span>
              </div>
              <Card>
                {monthRecords.map(({ attendance, session }) => {
                  const course = courseTypeOf(data, session)
                  return (
                    <Row
                      key={attendance.id}
                      leading={<span className={s.histDate}>{formatDate(session.date)}</span>}
                      title={
                        <span>
                          {session.topic === '' ? (course?.name ?? '課程') : session.topic}
                        </span>
                      }
                      subtitle={
                        <span style={{ display: 'inline-flex', gap: 'var(--sp-3)' }}>
                          <StatusTag status={attendance.status} />
                          {attendance.billedMinutes > 0 && (
                            <span>{formatMinutes(attendance.billedMinutes)}</span>
                          )}
                        </span>
                      }
                      trailing={
                        <span className={s.histAmount}>{formatMoney(attendance.amount)}</span>
                      }
                      onClick={() => navigate({ name: 'session', id: session.id })}
                    />
                  )
                })}
              </Card>
            </div>
          )
        })
      )}

      <StudentForm open={editing} student={student} onClose={() => setEditing(false)} />
    </>
  )
}
