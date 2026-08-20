import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
}

/**
 * 所有 icon 的唯一外框，統一線條語言。
 *
 * 規格（不得個別覆寫）：24×24 viewBox、stroke 取自 --stroke-w、圓端點、圓接角、
 * 只描邊不填色、顏色一律繼承 currentColor。這些規則就是「風格一致」的可驗收定義。
 */
export function IconBase({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ strokeWidth: 'var(--stroke-w)', flexShrink: 0 }}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}
