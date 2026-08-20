import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg'
  block?: boolean
  iconOnly?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  iconOnly = false,
  className,
  type = 'button',
  children,
  ...rest
}: Props) {
  const cls = [
    s.btn,
    s[variant],
    size === 'lg' && s.lg,
    block && s.block,
    iconOnly && s.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}
