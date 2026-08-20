import type { ReactNode } from 'react'
import { IconChevronRight } from '../icons'
import s from './Card.module.css'

export function Card({
  padded = false,
  className,
  children,
}: {
  padded?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={[s.card, padded && s.padded, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/** Card 內的一列。給 onClick 就會變成可點擊列並自動加上右箭頭。 */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      {leading}
      <div className={s.rowBody}>
        <div className={s.rowTitle}>{title}</div>
        {subtitle !== undefined && <div className={s.rowSubtitle}>{subtitle}</div>}
      </div>
      <div className={s.rowTrailing}>
        {trailing}
        {onClick && <IconChevronRight size={18} />}
      </div>
    </>
  )
  if (!onClick) return <div className={s.row}>{body}</div>
  return (
    <button type="button" className={`${s.row} ${s.interactive}`} onClick={onClick}>
      {body}
    </button>
  )
}
