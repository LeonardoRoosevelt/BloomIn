import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { STATEMENT_CSS } from './statementStyles'

/**
 * 把內容送到 <body> 下的列印容器。
 *
 * 列印時整個 #root 會被隱藏，所以月結單不能長在 App 樹裡面 ——
 * 父層一隱藏，它也會跟著不見。
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [host] = useState(() => {
    const el = document.createElement('div')
    el.className = 'print-root'
    return el
  })

  useEffect(() => {
    document.body.appendChild(host)
    return () => {
      host.remove()
    }
  }, [host])

  return createPortal(
    <>
      <style>{STATEMENT_CSS}</style>
      {children}
    </>,
    host,
  )
}
