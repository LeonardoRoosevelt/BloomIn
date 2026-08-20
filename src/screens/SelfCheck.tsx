import { useEffect, useState, type ReactNode } from 'react'
import s from './SelfCheck.module.css'
import { IconAlert, IconCheck, IconClose, IconInfo, IconPrinter, IconShare } from '../components/icons'
import { canShareFiles, isIos, isStandalone } from '../lib/platform'
import { shareFile } from '../lib/share'
import {
  loadProbe,
  requestPersistence,
  saveProbe,
  storageEstimate,
  type Probe,
} from '../store/db'

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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false })
}

export function SelfCheck() {
  const [checks, setChecks] = useState<Check[]>([])
  const [manual, setManual] = useState<string>('尚未測試')

  useEffect(() => {
    void runChecks().then(setChecks)
  }, [])

  function onPrint() {
    setManual('已呼叫 window.print()，請確認是否跳出列印預覽')
    window.print()
  }

  async function onShare() {
    const file = new File(['﻿日期,學生,金額\n2026-08-20,測試,500\n'], 'bloomin-test.csv', {
      type: 'text/csv',
    })
    const outcome = await shareFile(file, 'BloomIn 匯出測試')
    setManual(
      {
        shared: '✅ 分享面板成功送出檔案',
        downloaded: '⚠️ 分享面板不可用，已退回瀏覽器下載',
        cancelled: '分享面板有開啟，但你按了取消（能開啟就算通過）',
      }[outcome],
    )
  }

  return (
    <>
      <div className={s.page}>
        <div className={s.header}>
          <img src="/icons/icon-192.png" alt="" className={s.logo} />
          <div>
            <h1 className={s.title}>BloomIn 環境自檢</h1>
          </div>
        </div>
        <p className={s.subtitle}>
          Phase 0：確認這台裝置能支撐整個離線單機架構。四項全過才會往下開發。
        </p>

        <div className={s.section}>
          <div className={s.sectionTitle}>自動檢查</div>
          <div className={s.card}>
            {checks.length === 0 && (
              <div className={s.row}>
                <div className={s.rowBody}>
                  <div className={s.rowLabel}>檢查中…</div>
                </div>
              </div>
            )}
            {checks.map((c) => {
              const b = BADGE[c.level]
              return (
                <div className={s.row} key={c.id}>
                  <span className={`${s.badge} ${b.cls}`}>{b.node}</span>
                  <div className={s.rowBody}>
                    <div className={s.rowLabel}>{c.label}</div>
                    <div className={s.rowDetail}>{c.detail}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>手動測試</div>
          <div className={s.actions}>
            <button className={s.btn} onClick={() => void onPrint()}>
              <IconPrinter size={18} />
              測試列印（月結單 PDF 用）
            </button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => void onShare()}>
              <IconShare size={18} />
              測試分享檔案（CSV 匯出用）
            </button>
          </div>
          <p className={s.rowDetail} style={{ marginTop: 'var(--sp-3)' }}>
            結果：{manual}
          </p>
        </div>

        <div className={s.section}>
          <div className={s.note}>
            <strong>驗證持久化的正確做法：</strong>
            完全關閉這個 App（上滑移除多工卡片）再重新開啟，上方「重啟後資料仍在」的次數要增加。
            只按重新整理不算數。
          </div>
        </div>
      </div>

      {/* 列印驗證：畫面上隱藏，只在列印預覽出現，順便確認中文字型在列印時正常 */}
      <div className={s.printOnly}>
        <h1>BloomIn 列印測試</h1>
        <p>如果你在列印預覽裡看得到這一頁，代表月結單 PDF 這條路可行。</p>
        <p>中文字型檢查：素描、水彩、兒童繪畫班　學費 NT$1,200</p>
        <p>產生時間：{new Date().toLocaleString('zh-TW', { hour12: false })}</p>
      </div>
    </>
  )
}

/**
 * 逐項執行檢查。每一項都獨立包住例外 —— 任何一個 probe 拋錯
 * 都不該讓整頁停在「檢查中…」，那會讓實機驗證變成瞎猜。
 */
async function runChecks(): Promise<Check[]> {
  return [
    await safe('standalone', '以獨立 App 模式開啟', checkStandalone),
    await safe('sw', 'Service Worker 離線快取', checkServiceWorker),
    await safe('idb', '重啟後資料仍在', checkPersistence),
    await safe('persist', '已取得持久化儲存授權', checkPersistGrant),
    await safe('quota', '可用儲存空間', checkQuota),
    await safe('share', '原生分享面板可送出檔案', checkShare),
    await safe('platform', '裝置', checkPlatform),
  ]
}

async function safe(
  id: string,
  label: string,
  probe: () => Promise<Omit<Check, 'id' | 'label'>>,
): Promise<Check> {
  try {
    return { id, label, ...(await probe()) }
  } catch (err) {
    return { id, label, detail: `檢查失敗：${String(err)}`, level: 'fail' }
  }
}

type Outcome = Promise<Omit<Check, 'id' | 'label'>>

const checkStandalone = async (): Outcome => {
  const on = isStandalone()
  return {
    detail: on
      ? '已從主畫面啟動，沒有 Safari 網址列'
      : '目前在 Safari 分頁中。請用「分享 → 加入主畫面」後從主畫面重開，才測得到真實行為',
    level: on ? 'pass' : 'warn',
  }
}

const checkServiceWorker = async (): Outcome => {
  if (!('serviceWorker' in navigator)) {
    return { detail: '此瀏覽器不支援', level: 'fail' }
  }
  const secure = location.protocol === 'https:' || location.hostname === 'localhost'
  if (!secure) {
    return { detail: '目前不是 HTTPS，瀏覽器不允許註冊（開發模式的預期行為）', level: 'fail' }
  }
  const reg = await navigator.serviceWorker.getRegistration()
  const active = reg?.active?.state === 'activated'
  return {
    detail: active ? '已啟用。開飛航模式後仍應能冷啟動' : '尚未啟用，重新載入一次再看',
    level: active ? 'pass' : 'fail',
  }
}

const checkPersistence = async (): Outcome => {
  const now = new Date().toISOString()
  const prev = await loadProbe()
  const next: Probe = {
    firstSeenAt: prev?.firstSeenAt ?? now,
    lastSeenAt: now,
    launchCount: (prev?.launchCount ?? 0) + 1,
  }
  await saveProbe(next)
  return {
    detail: prev
      ? `第 ${next.launchCount} 次載入，首次寫入於 ${formatTime(next.firstSeenAt)}`
      : '這是第 1 次寫入。完全關閉 App 再開，這個數字要變成 2',
    level: prev ? 'pass' : 'info',
  }
}

const checkPersistGrant = async (): Outcome => {
  const granted = await requestPersistence()
  return {
    detail: granted
      ? '系統較不會在空間不足時回收本 App 資料'
      : '未取得授權。資料仍可用，但更依賴定期備份 —— 這是選擇 PWA 的已知代價',
    level: granted ? 'pass' : 'warn',
  }
}

const checkQuota = async (): Outcome => {
  const est = await storageEstimate()
  return {
    detail: est
      ? `已用 ${formatBytes(est.usage)} / 可用 ${formatBytes(est.quota)}`
      : '此瀏覽器不提供空間資訊',
    level: 'info',
  }
}

const checkShare = async (): Outcome => {
  const ok = canShareFiles()
  return {
    detail: ok
      ? '報表可直接存到「檔案」/ iCloud Drive，或送 AirDrop / LINE'
      : '不支援。匯出會退回瀏覽器下載，在 iOS standalone 下可能失敗',
    level: ok ? 'pass' : 'warn',
  }
}

const checkPlatform = async (): Outcome => ({
  detail: `${isIos() ? 'iOS / iPadOS' : '非 iOS'}\u3000${screen.width}\u00d7${screen.height} @${devicePixelRatio}x`,
  level: 'info',
})
