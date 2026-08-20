import { useMemo, useState } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { StudentForm } from '../components/StudentForm'
import { Button } from '../components/ui/Button'
import { Card, Row } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Pill } from '../components/ui/Pill'
import { IconPlus, IconSearch, IconStudents } from '../components/icons'
import { attendancesOfStudent, totalsOf } from '../domain/selectors'
import { formatMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './Students.module.css'

export function Students() {
  const data = useStore((st) => st.data)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const archivedCount = data.students.filter((st) => st.archived).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.students
      .filter((st) => (showArchived ? true : !st.archived))
      .filter(
        (st) =>
          q === '' ||
          st.name.toLowerCase().includes(q) ||
          st.phone.includes(q) ||
          st.guardianName.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  }, [data.students, query, showArchived])

  const hasAny = data.students.length > 0

  return (
    <>
      <ScreenHeader
        title="學生"
        actions={
          <Button iconOnly aria-label="新增學生" onClick={() => setCreating(true)}>
            <IconPlus size={22} />
          </Button>
        }
      />

      {hasAny && (
        <div className={s.search}>
          <span className={s.searchIcon}>
            <IconSearch size={18} />
          </span>
          <input
            className={s.searchInput}
            type="search"
            placeholder="搜尋姓名、電話或家長"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!hasAny ? (
        <EmptyState
          art={<IconStudents size={72} />}
          title="還沒有學生"
          description="新增學生後，建課時就會自動帶入對應課程的名單。"
          action={
            <Button onClick={() => setCreating(true)}>
              <IconPlus size={20} />
              新增學生
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState art={<IconSearch size={72} />} title="找不到符合的學生" />
      ) : (
        <>
          <div className={s.count}>{visible.length} 位</div>
          <Card>
            {visible.map((student) => {
              const totals = totalsOf(attendancesOfStudent(data, student.id))
              return (
                <Row
                  key={student.id}
                  title={
                    <span className={student.archived ? s.archivedRow : undefined}>
                      {student.name}
                      {student.archived && '（已封存）'}
                    </span>
                  }
                  subtitle={
                    <span className={s.tags}>
                      {student.courseTypeIds.map((cid) => {
                        const c = data.courseTypes.find((x) => x.id === cid)
                        return c ? (
                          <Pill key={cid} accent={c.accent} showDot={false}>
                            {c.name}
                          </Pill>
                        ) : null
                      })}
                    </span>
                  }
                  trailing={
                    totals.recordCount > 0 ? (
                      <span className={s.money}>{formatMoney(totals.amount)}</span>
                    ) : undefined
                  }
                  onClick={() => navigate({ name: 'student', id: student.id })}
                />
              )
            })}
          </Card>
        </>
      )}

      {archivedCount > 0 && (
        <div className={s.archivedToggle}>
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? '隱藏已封存' : `顯示已封存（${archivedCount}）`}
          </Button>
        </div>
      )}

      <StudentForm open={creating} student={null} onClose={() => setCreating(false)} />
    </>
  )
}
