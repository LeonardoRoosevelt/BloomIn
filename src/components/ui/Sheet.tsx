import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from '../icons'
import { Button } from './Button'
import s from './Sheet.module.css'

/**
 * 使用原生 <dialog> 而非自製 modal：焦點鎖定、Esc 關閉、背景 inert
 * 都由瀏覽器負責，不需自己實作，也不會漏掉無障礙細節。
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={s.dialog}
      onClose={onClose}
      onCancel={onClose}
      // 點擊 backdrop（也就是 dialog 本身而非內容）時關閉
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className={s.panel}>
        <div className={s.header}>
          <span className={s.title}>{title}</span>
          <Button variant="ghost" iconOnly aria-label="關閉" onClick={onClose}>
            <IconClose size={20} />
          </Button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </dialog>
  )
}
