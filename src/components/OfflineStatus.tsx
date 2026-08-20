import { useEffect, useState, type ReactNode } from 'react'
import { IconAlert, IconCheck, IconClose, IconInfo } from './icons'
import { canShareFiles, isStandalone } from '../lib/platform'
import { requestPersistence, storageEstimate } from '../store/db'
import s from './OfflineStatus.module.css'

type Level = 'pass' | 'fail' | 'warn' | 'info'

interface Check {
  id: string
  label: string
  detail: string
  level: Level
}

const BADGE: Record<Level, { cls: string; node: ReactNode }> = {
  pass: { cls: s.pass!, node: <IconCheck size={14} /> },
  fail: { cls: s.fail!, node: <IconClose size={14} /> },
  warn: { cls: s.warn!, node: <IconAlert size={14} /> },
  info: { cls: s.info!, node: <IconInfo size={14} /> },
}

/**
 * 離線就緒狀態。
 *
 * 「能不能離線用」不是使用者猜得出來的：Service Worker 只在 HTTPS 或 localhost
 * 註冊，從區網 HTTP 加到主畫面會拿到圖示卻沒有離線能力，而且沒有任何提示。
 * 這個面板把實際狀態攤開，並在失敗時說明原因。
 */
export function OfflineStatus() {
  const [checks, setChecks] = useState<Check[]>([])

  useEffect(() => {
    void runChecks().then(setChecks)
  }, [])

  return (
    <div className={s.card}>
      {checks.length === 0 && (
        <div className={s.row}>
          <span className={s.label}>檢查中…</span>
        </div>
      )}
      {checks.map((c) => {
        const b = BADGE[c.level]
        return (
          <div className={s.row} key={c.id}>
            <span className={`${s.badge} ${b.cls}`}>{b.node}</span>
            <span className={s.body}>
              <span className={s.label}>{c.label}</span>
              <span className={s.detail}>{c.detail}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 每項獨立包住例外：任何一項出錯都不該讓整個面板停在「檢查中…」。 */
async function runChecks(): Promise<Check[]> {
  return [
    await safe('sw', '可離線使用', checkServiceWorker),
    await safe('standalone', '以獨立 App 開啟', checkStandalone),
    await safe('persist', '持久化儲存', checkPersistence),
    await safe('quota', '儲存空間', checkQuota),
    await safe('share', '可用分享面板匯出', checkShare),
  ]
}

type Outcome = Promise<Omit<Check, 'id' | 'label'>>

async function safe(id: string, label: string, probe: () => Outcome): Promise<Check> {
  try {
    return { id, label, ...(await probe()) }
  } catch (err) {
    return { id, label, detail: `檢查失敗：${String(err)}`, level: 'fail' }
  }
}

const checkServiceWorker = async (): Outcome => {
  if (!('serviceWorker' in navigator)) {
    return { detail: '此瀏覽器不支援離線快取。', level: 'fail' }
  }
  if (!window.isSecureContext) {
    return {
      detail:
        '目前不是 HTTPS，瀏覽器不允許啟用離線快取。從這個網址加到主畫面只會有圖示，關掉伺服器後就打不開。',
      level: 'fail',
    }
  }
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg?.active?.state !== 'activated') {
    // 開發模式本來就不註冊 Service Worker，說成「尚未就緒」會讓人以為出了問題
    if (import.meta.env.DEV) {
      return { detail: '開發模式不啟用離線快取，這是預期行為。', level: 'info' }
    }
    return { detail: '尚未就緒，請重新載入一次再看。', level: 'warn' }
  }
  return { detail: '所有檔案已存在裝置上，關閉網路也能開啟。', level: 'pass' }
}

const checkStandalone = async (): Outcome => {
  const on = isStandalone()
  return {
    detail: on
      ? '已從主畫面啟動。'
      : '目前在瀏覽器分頁中。用「分享 → 加入主畫面」後從主畫面開啟。',
    level: on ? 'pass' : 'info',
  }
}

const checkPersistence = async (): Outcome => {
  const granted = await requestPersistence()
  return {
    detail: granted
      ? '系統較不會在空間不足時回收本 App 的資料。'
      : '未取得授權。資料仍可用，但更依賴定期備份。',
    level: granted ? 'pass' : 'warn',
  }
}

const checkQuota = async (): Outcome => {
  const est = await storageEstimate()
  return {
    detail: est
      ? `已用 ${formatBytes(est.usage)}，可用 ${formatBytes(est.quota)}。`
      : '此瀏覽器不提供空間資訊。',
    level: 'info',
  }
}

const checkShare = async (): Outcome => {
  const ok = canShareFiles()
  return {
    detail: ok
      ? '備份與報表可直接送到「檔案」、AirDrop 或 LINE。'
      : '不支援，匯出會退回瀏覽器下載。',
    level: ok ? 'pass' : 'warn',
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
