import type { ReactNode } from 'react'
import {
  IconBilling,
  IconCalendar,
  IconSettings,
  IconStudents,
  IconToday,
} from './icons'
import { navigate, useRoute, type Route } from '../lib/router'
import { BackupBanner } from './BackupBanner'
import s from './AppShell.module.css'

const NAV: readonly {
  route: Route
  label: string
  Icon: typeof IconToday
  /** 這個分頁底下還有哪些子路由，用來決定 tab 的選中狀態 */
  covers: readonly Route['name'][]
}[] = [
  { route: { name: 'today' }, label: '今日', Icon: IconToday, covers: ['today', 'session'] },
  { route: { name: 'calendar' }, label: '課表', Icon: IconCalendar, covers: ['calendar'] },
  { route: { name: 'students' }, label: '學生', Icon: IconStudents, covers: ['students', 'student'] },
  { route: { name: 'billing' }, label: '帳務', Icon: IconBilling, covers: ['billing'] },
  { route: { name: 'settings' }, label: '設定', Icon: IconSettings, covers: ['settings'] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute()
  return (
    <div className={s.shell}>
      <nav className={s.nav} aria-label="主導覽">
        <div className={`${s.brand} ${s.tabletOnly}`}>
          <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" className={s.brandMark} />
          BloomIn
        </div>
        {NAV.map(({ route: target, label, Icon, covers }) => {
          const active = covers.includes(route.name)
          return (
            <button
              key={label}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={[s.navItem, active && s.navItemActive].filter(Boolean).join(' ')}
              onClick={() => navigate(target)}
            >
              <Icon size={24} />
              <span className={s.navLabel}>{label}</span>
            </button>
          )
        })}
      </nav>
      <div className={s.content}>
        <BackupBanner />
        <div className={s.inner}>{children}</div>
      </div>
    </div>
  )
}

/** 每個畫面共用的標題列。 */
export function ScreenHeader({
  title,
  actions,
}: {
  title: string
  actions?: ReactNode
}) {
  return (
    <header className={s.screenHeader}>
      <h1 className={s.screenTitle}>{title}</h1>
      {actions && <div className={s.screenActions}>{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={s.sectionTitle}>{children}</h2>
}
