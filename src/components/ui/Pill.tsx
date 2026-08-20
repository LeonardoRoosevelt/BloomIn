import type { CSSProperties, ReactNode } from 'react'
import { accentSoft, accentVar } from '../../lib/accent'
import type { AccentToken } from '../../domain/types'
import s from './Pill.module.css'

/**
 * 課程類型標籤。列表中用色點＋色字辨識課程，而非 icon ——
 * palette icon 在 16px 以下辨識度不足，顏色在小尺寸反而更快讀懂。
 */
export function Pill({
  accent,
  children,
  showDot = true,
}: {
  accent: AccentToken
  children: ReactNode
  showDot?: boolean
}) {
  const style = {
    '--pill-tone': accentVar(accent),
    '--pill-bg': accentSoft(accent),
  } as CSSProperties
  return (
    <span className={s.pill} style={style}>
      {showDot && <span className={s.dot} />}
      {children}
    </span>
  )
}
