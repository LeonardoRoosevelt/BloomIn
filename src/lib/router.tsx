import { useEffect, useState } from 'react'

/**
 * 極簡路由。
 *
 * 不引入 react-router：本 App 只有七個畫面，且需要的只是「路徑 ↔ 畫面」對應。
 * 使用真正的 History API 而非 hash，讓 iOS standalone 模式下的邊緣滑動返回可以運作。
 */
/**
 * 站台的基底路徑，例如 '/BloomIn/'。由 vite 的 base 設定推導，
 * 部署到子路徑時網址會多一層，路由必須自己處理這一層。
 */
const BASE = import.meta.env.BASE_URL

/** '/BloomIn/billing' → '/billing' */
function stripBase(pathname: string): string {
  return pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname
}

/** '/billing' → '/BloomIn/billing' */
function withBase(path: string): string {
  return BASE.replace(/\/$/, '') + path
}

export type Route =
  | { name: 'today' }
  | { name: 'session'; id: string }
  | { name: 'calendar' }
  | { name: 'students' }
  | { name: 'student'; id: string }
  | { name: 'billing' }
  | { name: 'settings' }

export function parseRoute(pathname: string): Route {
  const seg = stripBase(pathname).split('/').filter(Boolean)
  switch (seg[0]) {
    case undefined:
      return { name: 'today' }
    case 'session':
      return seg[1] ? { name: 'session', id: seg[1] } : { name: 'today' }
    case 'calendar':
      return { name: 'calendar' }
    case 'students':
      return seg[1] ? { name: 'student', id: seg[1] } : { name: 'students' }
    case 'billing':
      return { name: 'billing' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'today' }
  }
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'today':
      return '/'
    case 'session':
      return `/session/${route.id}`
    case 'calendar':
      return '/calendar'
    case 'students':
      return '/students'
    case 'student':
      return `/students/${route.id}`
    case 'billing':
      return '/billing'
    case 'settings':
      return '/settings'
  }
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = withBase(routePath(route))
  if (options.replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function goBack(): void {
  history.back()
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname))
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}
