import { IconBackup, IconChevronRight } from './icons'
import { daysSinceBackup, needsBackupReminder } from '../store/backup'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './BackupBanner.module.css'

/**
 * 未備份提醒。
 *
 * 刻意做成不能關閉的常駐橫幅，而不是設定裡的一個選項：PWA 的資料存在瀏覽器
 * 儲存區，刪掉主畫面圖示就會一起消失且無法復原。定期備份是唯一的保命機制，
 * 所以它必須一直看得見，直到真的備份為止。
 */
export function BackupBanner() {
  const settings = useStore((st) => st.data.settings)
  const hasData = useStore(
    (st) => st.data.students.length > 0 || st.data.sessions.length > 0,
  )

  const now = new Date()
  // 還沒有任何資料時不必嚇人 —— 沒東西可丟
  if (!hasData) return null
  if (!needsBackupReminder(settings.lastBackupAt, settings.backupReminderDays, now)) return null

  const days = daysSinceBackup(settings.lastBackupAt, now)

  return (
    <button type="button" className={s.banner} onClick={() => navigate({ name: 'settings' })}>
      <span className={s.icon}>
        <IconBackup size={22} />
      </span>
      <span className={s.text}>
        <span className={s.title}>
          {days === null ? '尚未備份過資料' : `已 ${days} 天沒有備份`}
        </span>
        <span className={s.detail}>
          刪除主畫面圖示或清除網站資料會讓紀錄消失且無法復原。
        </span>
      </span>
      <IconChevronRight size={18} />
    </button>
  )
}
