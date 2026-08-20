import { useState } from 'react'
import { Button } from './ui/Button'
import { Sheet } from './ui/Sheet'
import { Pill } from './ui/Pill'
import { StudentForm } from './StudentForm'
import { IconCheck, IconPlus } from './icons'
import { useStore } from '../store/useStore'
import type { Session } from '../domain/types'
import s from './RosterSheet.module.css'

/** 調整某堂課的學生名單。移出名單不會刪除已存在的出席紀錄，重新加回即恢復。 */
export function RosterSheet({
  open,
  session,
  onClose,
}: {
  open: boolean
  session: Session
  onClose: () => void
}) {
  const students = useStore((st) => st.data.students)
  const courseTypes = useStore((st) => st.data.courseTypes)
  const updateSession = useStore((st) => st.updateSession)
  const [addingStudent, setAddingStudent] = useState(false)

  const selected = new Set(session.rosterStudentIds)

  function toggle(id: string) {
    const next = selected.has(id)
      ? session.rosterStudentIds.filter((x) => x !== id)
      : [...session.rosterStudentIds, id]
    updateSession(session.id, { rosterStudentIds: next })
  }

  const visible = students.filter((st) => !st.archived)

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="本堂學生名單"
        footer={<Button onClick={onClose}>完成</Button>}
      >
        <Button variant="secondary" block onClick={() => setAddingStudent(true)}>
          <IconPlus size={20} />
          新增學生
        </Button>

        {visible.length === 0 ? (
          <p className={s.empty}>還沒有任何學生，請先新增。</p>
        ) : (
          <ul className={s.list}>
            {visible.map((student) => {
              const on = selected.has(student.id)
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    className={s.item}
                    aria-pressed={on}
                    onClick={() => toggle(student.id)}
                  >
                    <span className={`${s.check} ${on ? s.checkOn : ''}`}>
                      {on && <IconCheck size={14} />}
                    </span>
                    <span className={s.name}>{student.name}</span>
                    <span className={s.tags}>
                      {student.courseTypeIds.map((cid) => {
                        const c = courseTypes.find((x) => x.id === cid)
                        return c ? (
                          <Pill key={cid} accent={c.accent} showDot={false}>
                            {c.name}
                          </Pill>
                        ) : null
                      })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>

      <StudentForm
        open={addingStudent}
        student={null}
        onClose={() => setAddingStudent(false)}
        onSaved={(id) =>
          updateSession(session.id, { rosterStudentIds: [...session.rosterStudentIds, id] })
        }
      />
    </>
  )
}
