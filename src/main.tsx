import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/base.css'
import { SelfCheck } from './screens/SelfCheck'

// autoUpdate：新版本下載完成後直接接管，不打擾使用者。
// 單機 App 沒有伺服器狀態要同步，靜默更新沒有風險。
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <SelfCheck />
  </StrictMode>,
)
