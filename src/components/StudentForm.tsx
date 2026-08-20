import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Field, FieldRow, Input, Textarea } from './ui/Field'
import { Sheet } from './ui/Sheet'
import { Pill } from './ui/Pill'
import { useStore } from '../store/useStore'
import type { Student } from '../domain/types'

interface Draft {
  name: string
  phone: string
  guardianName: string
  guardianPhone: string
  courseTypeIds: string[]
  hourlyRateOverride: string
  note: string
}

function toDraft(s: Student | null): Draft {
  return {
    name: s?.name ?? '',
    phone: s?.phone ?? '',
    guardianName: s?.guardianName ?? '',
    guardianPhone: s?.guardianPhone ?? '',
    courseTypeIds: s?.courseTypeIds ?? [],
    hourlyRateOverride: s?.hourlyRateOverride == null ? '' : String(s.hourlyRateOverride),
    note: s?.note ?? '',
  }
}

export function StudentForm({
  open,
  student,
  onClose,
  onSaved,
}: {
  open: boolean
  /** null 表示新增 */
  student: Student | null
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const courseTypes = useStore((s) => s.data.courseTypes)
  const addStudent = useStore((s) => s.addStudent)
  const updateStudent = useStore((s) => s.updateStudent)

  const [draft, setDraft] = useState<Draft>(() => toDraft(student))
  const [touched, setTouched] = useState(false)

  // 每次開啟都以當下的 student 重置，避免沿用上一次編輯的殘留內容
  useEffect(() => {
    if (open) {
      setDraft(toDraft(student))
      setTouched(false)
    }
  }, [open, student])

  const nameError = touched && draft.name.trim() === '' ? '請輸入姓名' : undefined
  const rateError =
    touched && draft.hourlyRateOverride !== '' && !isValidRate(draft.hourlyRateOverride)
      ? '請輸入 0 或正整數'
      : undefined

  function save() {
    setTouched(true)
    if (draft.name.trim() === '') return
    if (draft.hourlyRateOverride !== '' && !isValidRate(draft.hourlyRateOverride)) return

    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      guardianName: draft.guardianName.trim(),
      guardianPhone: draft.guardianPhone.trim(),
      courseTypeIds: draft.courseTypeIds,
      // 空字串代表「沿用課程費率」，與 0（免費生）是不同意思，所以不能簡化成 Number()
      hourlyRateOverride:
        draft.hourlyRateOverride === '' ? null : Number(draft.hourlyRateOverride),
      note: draft.note.trim(),
      archived: student?.archived ?? false,
    }

    // 先建立再通知：寫成 onSaved?.(addStudent(...)) 會在 onSaved 未提供時
    // 被 optional chaining 整段短路，導致學生根本沒被新增。
    const id = student ? (updateStudent(student.id, payload), student.id) : addStudent(payload)
    onSaved?.(id)
    onClose()
  }

  function toggleCourse(id: string) {
    setDraft((d) => ({
      ...d,
      courseTypeIds: d.courseTypeIds.includes(id)
        ? d.courseTypeIds.filter((x) => x !== id)
        : [...d.courseTypeIds, id],
    }))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={student ? '編輯學生' : '新增學生'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <Field label="姓名" error={nameError}>
        <Input
          value={draft.name}
          invalid={nameError !== undefined}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          autoComplete="off"
        />
      </Field>

      <Field label="電話">
        <Input
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
        />
      </Field>

      <FieldRow>
        <Field label="家長姓名">
          <Input
            value={draft.guardianName}
            onChange={(e) => setDraft({ ...draft, guardianName: e.target.value })}
          />
        </Field>
        <Field label="家長電話">
          <Input
            type="tel"
            inputMode="tel"
            value={draft.guardianPhone}
            onChange={(e) => setDraft({ ...draft, guardianPhone: e.target.value })}
          />
        </Field>
      </FieldRow>

      <Field label="修習課程">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          {courseTypes
            .filter((c) => !c.archived)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCourse(c.id)}
                style={{
                  opacity: draft.courseTypeIds.includes(c.id) ? 1 : 0.35,
                  padding: 'var(--sp-1)',
                }}
                aria-pressed={draft.courseTypeIds.includes(c.id)}
              >
                <Pill accent={c.accent}>{c.name}</Pill>
              </button>
            ))}
        </div>
      </Field>

      <Field
        label="個別時薪"
        error={rateError}
        hint="留空表示沿用課程類型的費率。填 0 代表這位學生免費。"
      >
        <Input
          numeric
          inputMode="numeric"
          placeholder="沿用課程費率"
          value={draft.hourlyRateOverride}
          invalid={rateError !== undefined}
          onChange={(e) => setDraft({ ...draft, hourlyRateOverride: e.target.value })}
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

function isValidRate(v: string): boolean {
  return /^\d+$/.test(v)
}
