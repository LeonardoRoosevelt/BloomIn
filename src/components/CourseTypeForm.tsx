import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { Sheet } from './ui/Sheet'
import { IconCheck, IconTrash } from './icons'
import { ACCENT_TOKENS, type AccentToken, type CourseType } from '../domain/types'
import { sessionCountForCourseType } from '../domain/selectors'
import { accentVar } from '../lib/accent'
import { useStore } from '../store/useStore'
import type { CSSProperties } from 'react'
import s from './CourseTypeForm.module.css'

export function CourseTypeForm({
  open,
  courseType,
  onClose,
}: {
  open: boolean
  /** null 表示新增 */
  courseType: CourseType | null
  onClose: () => void
}) {
  const data = useStore((st) => st.data)
  const addCourseType = useStore((st) => st.addCourseType)
  const updateCourseType = useStore((st) => st.updateCourseType)
  const deleteCourseType = useStore((st) => st.deleteCourseType)

  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [accent, setAccent] = useState<AccentToken>('terracotta')
  const [chargeOnAbsence, setChargeOnAbsence] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(courseType?.name ?? '')
    setRate(String(courseType?.hourlyRate ?? data.settings.defaultHourlyRate))
    // 新增時自動挑一個還沒被用掉的識別色，順序即 tokens.css 驗證過的相鄰順序
    setAccent(courseType?.accent ?? nextFreeAccent(data.courseTypes))
    setChargeOnAbsence(courseType?.chargeOnAbsence ?? false)
    setTouched(false)
  }, [open, courseType, data.courseTypes, data.settings.defaultHourlyRate])

  const nameError = touched && name.trim() === '' ? '請輸入名稱' : undefined
  const rateError = touched && !/^\d+$/.test(rate) ? '請輸入 0 或正整數' : undefined

  const usedBy = courseType ? sessionCountForCourseType(data, courseType.id) : 0

  function save() {
    setTouched(true)
    if (name.trim() === '' || !/^\d+$/.test(rate)) return
    const payload = {
      name: name.trim(),
      hourlyRate: Number(rate),
      accent,
      chargeOnAbsence,
      archived: courseType?.archived ?? false,
    }
    if (courseType) updateCourseType(courseType.id, payload)
    else addCourseType(payload)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={courseType ? '編輯課程類型' : '新增課程類型'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <Field label="名稱" error={nameError}>
        <Input
          value={name}
          invalid={nameError !== undefined}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field
        label="時薪"
        error={rateError}
        hint="學生若設定了個別時薪，會蓋過這個值。"
      >
        <Input
          numeric
          inputMode="numeric"
          value={rate}
          invalid={rateError !== undefined}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>

      <Field label="識別色">
        <div className={s.swatches}>
          {ACCENT_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              aria-label={token}
              aria-pressed={token === accent}
              className={`${s.swatch} ${token === accent ? s.swatchOn : ''}`}
              style={{ '--swatch': accentVar(token) } as CSSProperties}
              onClick={() => setAccent(token)}
            >
              {token === accent && <IconCheck size={18} />}
            </button>
          ))}
        </div>
      </Field>

      <div className={s.toggleRow}>
        <div className={s.toggleText}>
          <div className={s.toggleLabel}>無故缺席仍計費</div>
          <div className={s.toggleHint}>
            按排定時數收費。事先請假一律不收，不受這個設定影響。
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={chargeOnAbsence}
          aria-label="無故缺席仍計費"
          className={`${s.switch} ${chargeOnAbsence ? s.switchOn : ''}`}
          onClick={() => setChargeOnAbsence((v) => !v)}
        >
          <span className={s.knob} />
        </button>
      </div>

      {courseType && (
        <div className={s.danger}>
          <div className={s.dangerActions}>
            <Button
              variant="secondary"
              onClick={() => {
                updateCourseType(courseType.id, { archived: !courseType.archived })
                onClose()
              }}
            >
              {courseType.archived ? '取消封存' : '封存'}
            </Button>
            <Button
              variant="danger"
              disabled={usedBy > 0}
              onClick={() => {
                deleteCourseType(courseType.id)
                onClose()
              }}
            >
              <IconTrash size={18} />
              刪除
            </Button>
          </div>
          <p className={s.dangerNote}>
            {usedBy > 0
              ? `已有 ${usedBy} 堂課使用這個類型，刪除會讓那些課失去名稱與識別色，月結單上只剩認不出來的項目。請改用封存 —— 封存後不再出現在建課選單，歷史紀錄照常顯示。`
              : '目前沒有任何課程使用這個類型，可以安全刪除。'}
          </p>
        </div>
      )}
    </Sheet>
  )
}

/** 挑一個尚未被使用的識別色；都用過了就從頭循環。 */
function nextFreeAccent(existing: readonly CourseType[]): AccentToken {
  const used = new Set(existing.map((c) => c.accent))
  return ACCENT_TOKENS.find((t) => !used.has(t)) ?? ACCENT_TOKENS[existing.length % ACCENT_TOKENS.length]!
}
