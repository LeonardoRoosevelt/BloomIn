import type { CSSProperties } from 'react'
import {
  IconStatusAbsent,
  IconStatusExcused,
  IconStatusLate,
  IconStatusPresent,
} from './icons'
import type { AttendanceStatus } from '../domain/types'
import s from './StatusTag.module.css'

/** 出席狀態的單一顯示來源：文字、icon 與語意色都定義在這裡，各畫面不得自行拼裝。 */
export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; tone: string; Icon: typeof IconStatusPresent }
> = {
  present: { label: '出席', tone: 'var(--success)', Icon: IconStatusPresent },
  late: { label: '遲到', tone: 'var(--warning)', Icon: IconStatusLate },
  excused: { label: '請假', tone: 'var(--text-secondary)', Icon: IconStatusExcused },
  absent: { label: '缺席', tone: 'var(--danger)', Icon: IconStatusAbsent },
}

export function StatusTag({
  status,
  showLabel = true,
  size = 16,
}: {
  status: AttendanceStatus
  showLabel?: boolean
  size?: number
}) {
  const { label, tone, Icon } = STATUS_META[status]
  return (
    <span className={s.tag} style={{ '--tone': tone } as CSSProperties} title={label}>
      <Icon size={size} />
      {showLabel && label}
    </span>
  )
}
