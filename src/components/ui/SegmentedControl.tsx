import type { CSSProperties, ReactNode } from 'react'
import s from './SegmentedControl.module.css'

export interface Segment<T extends string> {
  value: T
  label: ReactNode
  /** CSS 色值（請用 tokens 的變數），選中時套用到文字上 */
  tone?: string
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
}: {
  segments: readonly Segment<T>[]
  /** null 代表尚未選擇（例如學生還沒點名），此時所有選項都不亮起 */
  value: T | null
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div className={s.wrap} role="radiogroup" aria-label={ariaLabel}>
      {segments.map((seg) => {
        const active = seg.value === value
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={[s.seg, active && s.active].filter(Boolean).join(' ')}
            {...(active && seg.tone ? { 'data-tone': '', style: { '--tone': seg.tone } as CSSProperties } : {})}
            onClick={() => onChange(seg.value)}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
