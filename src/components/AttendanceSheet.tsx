import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Field, FieldRow, Input, Textarea } from './ui/Field'
import { Sheet } from './ui/Sheet'
import { formatMinutes, validateTimeWindow } from '../domain/billing'
import { formatMoney } from '../lib/format'
import { useStore } from '../store/useStore'
import type { Attendance, Session, Student } from '../domain/types'

/**
 * 單一學生在某堂課的細部調整：實際起訖時間、手動指定金額、備註。
 *
 * 點名清單只放最常用的狀態切換，這些較少用到的欄位收進這裡，
 * 避免整份名單被輸入框塞滿而難以快速掃視。
 */
export function AttendanceSheet({
  open,
  session,
  student,
  attendance,
  onClose,
}: {
  open: boolean
  session: Session
  student: Student | null
  attendance: Attendance | null
  onClose: () => void
}) {
  const setAttendance = useStore((s) => s.setAttendance)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [manual, setManual] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setStart(attendance?.actualStart ?? session.startTime)
    setEnd(attendance?.actualEnd ?? session.endTime)
    setManual(attendance?.manualAmountOverride == null ? '' : String(attendance.manualAmountOverride))
    setNote(attendance?.note ?? '')
  }, [open, attendance, session])

  const timeError = validateTimeWindow(start, end)
  const manualError = manual !== '' && !/^\d+$/.test(manual) ? '請輸入 0 或正整數' : undefined

  function save() {
    if (timeError !== null || manualError !== undefined || !student) return
    setAttendance(session.id, student.id, {
      // 與該堂課排定時間相同時存 null，之後課程時間若被訂正，這位學生會自動跟著更新
      actualStart: start === session.startTime ? null : start,
      actualEnd: end === session.endTime ? null : end,
      manualAmountOverride: manual === '' ? null : Number(manual),
      note: note.trim(),
    })
    onClose()
  }

  function resetTimes() {
    setStart(session.startTime)
    setEnd(session.endTime)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={student ? `${student.name} · 本堂調整` : '本堂調整'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <FieldRow>
        <Field label="實際開始">
          <Input
            type="time"
            value={start}
            invalid={timeError !== null}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="實際結束" error={timeError ?? undefined}>
          <Input
            type="time"
            value={end}
            invalid={timeError !== null}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </FieldRow>

      <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <Button variant="secondary" onClick={resetTimes}>
          恢復為課程時間
        </Button>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          {session.startTime}–{session.endTime}
        </span>
      </div>

      <Field
        label="手動指定金額"
        error={manualError}
        hint={
          attendance
            ? `留空則依時數計算，目前為 ${formatMinutes(attendance.billedMinutes)}／${formatMoney(attendance.amount)}`
            : '留空則依時數自動計算'
        }
      >
        <Input
          numeric
          inputMode="numeric"
          placeholder="依時數計算"
          value={manual}
          invalid={manualError !== undefined}
          onChange={(e) => setManual(e.target.value)}
        />
      </Field>

      <Field label="本堂備註">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  )
}
