import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import s from './Field.module.css'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  // 顯式加上 undefined：exactOptionalPropertyTypes 下，React 元件常會傳入
  // 條件運算得到的 undefined，這是預期用法而非錯誤
  hint?: string | undefined
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
      {error !== undefined ? (
        <span className={s.error}>{error}</span>
      ) : hint !== undefined ? (
        <span className={s.hint}>{hint}</span>
      ) : null}
    </label>
  )
}

/** 把多個 Field 併成一列（例如開始時間 / 結束時間）。 */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={`${s.field} ${s.inline}`}>{children}</div>
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean
  invalid?: boolean
}

export function Input({ numeric, invalid, className, ...rest }: InputProps) {
  return (
    <input
      className={[s.control, numeric && s.numeric, invalid && s.invalid, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}

export function Select({
  invalid,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={[s.control, invalid && s.invalid, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[s.control, className].filter(Boolean).join(' ')} {...rest} />
}
