import { IconBase, type IconProps } from './IconBase'

export function IconCheck(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </IconBase>
  )
}

export function IconClose(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 6 18 18M18 6 6 18" />
    </IconBase>
  )
}

export function IconAlert(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3.5 22 20.5H2L12 3.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5h.01" />
    </IconBase>
  )
}

export function IconInfo(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </IconBase>
  )
}

export function IconPrinter(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14.5" width="10" height="6" rx="1" />
    </IconBase>
  )
}

export function IconShare(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 15.5V3.5" />
      <path d="M8 7.5 12 3.5l4 4" />
      <path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </IconBase>
  )
}

export function IconRefresh(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4v5h-5" />
    </IconBase>
  )
}
