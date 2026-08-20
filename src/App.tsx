import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { useRoute } from './lib/router'
import { useStore } from './store/useStore'
import { Today } from './screens/Today'
import { SessionDetail } from './screens/SessionDetail'
import { Calendar } from './screens/Calendar'
import { Students } from './screens/Students'
import { Billing } from './screens/Billing'
import { Settings } from './screens/Settings'

export function App() {
  const route = useRoute()
  const hydrated = useStore((st) => st.hydrated)
  const hydrate = useStore((st) => st.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // 資料尚未從 IndexedDB 載入前不渲染畫面，避免先閃出空狀態再跳成有資料
  if (!hydrated) return null

  return (
    <AppShell>
      {route.name === 'today' && <Today />}
      {route.name === 'session' && <SessionDetail sessionId={route.id} />}
      {route.name === 'calendar' && <Calendar />}
      {(route.name === 'students' || route.name === 'student') && <Students />}
      {route.name === 'billing' && <Billing />}
      {route.name === 'settings' && <Settings />}
    </AppShell>
  )
}
