import { IconAlert } from './icons'
import { useStore } from '../store/useStore'
import s from './PersistErrorBanner.module.css'

/**
 * 存檔失敗警告。
 *
 * 與備份提醒一樣刻意不能關閉：資料沒有存進裝置時，關掉 App 就會遺失，
 * 老師必須一直看得見，直到下一次寫入成功為止（會自動消失）。
 */
export function PersistErrorBanner() {
  const persistError = useStore((st) => st.persistError)
  if (persistError === null) return null
  return (
    <div className={s.banner} role="alert">
      <span className={s.icon}>
        <IconAlert size={22} />
      </span>
      <span className={s.text}>資料沒有存進裝置：{persistError}。請先匯出備份。</span>
    </div>
  )
}
