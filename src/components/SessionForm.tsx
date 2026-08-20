import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Field, FieldRow, Input, Select, Textarea } from './ui/Field'
import { Sheet } from './ui/Sheet'
import { validateTimeWindow } from '../domain/billing'
import { defaultSessionTimes, todayISO } from '../lib/date'
import { useStore } from '../store/useStore'
import type { Session } from '../domain/types'

interface Draft {
  date: string
  startTime: string
  endTime: string
  courseTypeId: string
  topic: string
  note: string
}

export function SessionForm({
  open,
  session,
  onClose,
  onSaved,
}: {
  open: boolean
  /** null 表示新增 */
  session: Session | null
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const courseTypes = useStore((s) => s.data.courseTypes)
  const students = useStore((s) => s.data.students)
  const addSession = useStore((s) => s.addSession)
  const updateSession = useStore((s) => s.updateSession)

  const active = courseTypes.filter((c) => !c.archived)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(session, active[0]?.id ?? ''))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(initialDraft(session, active[0]?.id ?? ''))
      setTouched(false)
    }
    // active 每次 render 都是新陣列，只依賴第一筆的 id 就足夠
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, active[0]?.id])

  const timeError = touched ? validateTimeWindow(draft.startTime, draft.endTime) : null
  const courseError = touched && draft.courseTypeId === '' ? '請選擇課程類型' : undefined

  function save() {
    setTouched(true)
    if (validateTimeWindow(draft.startTime, draft.endTime) !== null) return
    if (draft.courseTypeId === '') return

    if (session) {
      updateSession(session.id, {
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        courseTypeId: draft.courseTypeId,
        topic: draft.topic.trim(),
        note: draft.note.trim(),
      })
      onSaved?.(session.id)
    } else {
      // 新課預設帶入所有修習該課程的學生，老師再於點名畫面增減
      const roster = students
        .filter((s) => !s.archived && s.courseTypeIds.includes(draft.courseTypeId))
        .map((s) => s.id)
      onSaved?.(
        addSession({
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          courseTypeId: draft.courseTypeId,
          topic: draft.topic.trim(),
          note: draft.note.trim(),
          rosterStudentIds: roster,
        }),
      )
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={session ? '編輯課程' : '新增課程'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <Field label="日期">
        <Input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
      </Field>

      <FieldRow>
        <Field label="開始時間">
          <Input
            type="time"
            value={draft.startTime}
            invalid={timeError !== null}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          />
        </Field>
        <Field label="結束時間" error={timeError ?? undefined}>
          <Input
            type="time"
            value={draft.endTime}
            invalid={timeError !== null}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          />
        </Field>
      </FieldRow>

      <Field label="課程類型" error={courseError}>
        <Select
          value={draft.courseTypeId}
          invalid={courseError !== undefined}
          onChange={(e) => setDraft({ ...draft, courseTypeId: e.target.value })}
        >
          <option value="">請選擇</option>
          {active.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="課程內容" hint="例如：靜物素描 — 明暗與投影">
        <Input
          value={draft.topic}
          onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
        />
      </Field>

      <Field label="備註">
        <Textarea
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </Field>
    </Sheet>
  )
}

function initialDraft(session: Session | null, fallbackCourseId: string): Draft {
  if (session) {
    return {
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      courseTypeId: session.courseTypeId,
      topic: session.topic,
      note: session.note,
    }
  }
  return {
    date: todayISO(),
    ...defaultSessionTimes(),
    courseTypeId: fallbackCourseId,
    topic: '',
    note: '',
  }
}
