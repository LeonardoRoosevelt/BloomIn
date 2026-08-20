import type { ReactNode } from 'react'
import s from './EmptyState.module.css'

export function EmptyState({
  art,
  title,
  description,
  action,
}: {
  art: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className={s.wrap}>
      <div className={s.art}>{art}</div>
      <div className={s.title}>{title}</div>
      {description !== undefined && <p className={s.desc}>{description}</p>}
      {action}
    </div>
  )
}
