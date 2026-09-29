import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { useRoute } from './lib/router'
import { useStore } from './store/useStore'
import { Today } from './screens/Today'
import { SessionDetail } from './screens/SessionDetail'
import { Calendar } from './screens/Calendar'
import { Students } from './screens/Students'
import { StudentDetail } from './screens/StudentDetail'
import { StudentPhotos } from './screens/StudentPhotos'
import { Billing } from './screens/Billing'
import { Settings } from './screens/Settings'
import { EmptyState } from './components/ui/EmptyState'
import { Button } from './components/ui/Button'
import { IconAlert } from './components/icons'

export function App() {
  const route = useRoute()
  const hydrated = useStore((st) => st.hydrated)
  const hydrateError = useStore((st) => st.hydrateError)
  const hydrate = useStore((st) => st.hydrate)
  const upgradeBlocked = useStore((st) => st.upgradeBlocked)
  const superseded = useStore((st) => st.superseded)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // 已把資料庫讓給較新版本：本分頁寫不進任何東西，整個畫面換成提示，
  // 不讓人繼續輸入後靜默遺失。不自動重新載入，免得正在看的畫面無預警消失
  if (superseded) return <Superseded />

  // 資料尚未從 IndexedDB 載入前不渲染畫面，避免先閃出空狀態再跳成有資料。
  // 唯一例外是升級被舊分頁擋住：這可能要等很久，必須說明原因，否則就是一片白畫面。
  if (!hydrated) return upgradeBlocked ? <UpgradeBlocked /> : null

  // 讀不到資料時停在錯誤畫面，不讓使用者開始輸入 ——
  // 在載入失敗的狀態下新增資料，會把可能還救得回來的舊資料覆蓋掉。
  if (hydrateError !== null) return <LoadFailure message={hydrateError} />

  return (
    <AppShell>
      {route.name === 'today' && <Today />}
      {route.name === 'session' && <SessionDetail sessionId={route.id} />}
      {route.name === 'calendar' && <Calendar />}
      {route.name === 'students' && <Students />}
      {route.name === 'student' && <StudentDetail studentId={route.id} />}
      {route.name === 'student-photos' && <StudentPhotos studentId={route.id} />}
      {route.name === 'billing' && <Billing />}
      {route.name === 'settings' && <Settings />}
    </AppShell>
  )
}

function Superseded() {
  return (
    <div style={{ padding: 'var(--sp-5)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <EmptyState
        art={<IconAlert size={72} />}
        title="BloomIn 已在其他分頁更新，請重新開啟 App"
        description="這個畫面使用的是舊版，已無法儲存資料。離開前的最後變更已經存好。"
        action={<Button onClick={() => location.reload()}>重新載入</Button>}
      />
    </div>
  )
}

function UpgradeBlocked() {
  return (
    <div style={{ padding: 'var(--sp-5)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <EmptyState
        art={<IconAlert size={72} />}
        title="正在更新本機資料格式"
        description="請關閉其他開著的 BloomIn 分頁或視窗（在 iPhone 上可從多工畫面把舊的 BloomIn 滑掉）。關閉後這裡會自動繼續，資料不會遺失。"
      />
    </div>
  )
}

function LoadFailure({ message }: { message: string }) {
  return (
    <div style={{ padding: 'var(--sp-5)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <EmptyState
        art={<IconAlert size={72} />}
        title="無法讀取本機資料"
        description={`${message}。資料可能仍在，請先重新載入；若持續失敗，請勿在此狀態下新增資料。`}
        action={<Button onClick={() => location.reload()}>重新載入</Button>}
      />
    </div>
  )
}
