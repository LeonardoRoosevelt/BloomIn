import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { IconShare, IconUpload } from './icons'
import { daysSinceBackup } from '../store/backup'
import { loadPhotoBackupAt } from '../store/db'
import { describeExport, describeImport, exportPhotoBackup, importPhotoBackup } from '../store/photoBackup'
import { useStore } from '../store/useStore'
// 與資料備份同一種卡片外觀，直接共用樣式
import s from './BackupPanel.module.css'

/**
 * 照片備份：與資料備份分開的 zip。
 *
 * 匯入只做合併，絕不覆蓋本機照片，所以不需要像資料備份那樣先確認再覆蓋。
 */
export function PhotoBackupPanel() {
  const students = useStore((st) => st.data.students)
  const fileRef = useRef<HTMLInputElement>(null)
  const [lastAt, setLastAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void loadPhotoBackupAt().then(setLastAt)
  }, [])

  const days = daysSinceBackup(lastAt, new Date())

  async function run(task: () => Promise<{ kind: 'ok' | 'err'; text: string }>) {
    // 照片多時打包／解開要好幾秒，處理中擋住重複操作
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await task())
    } catch (err) {
      setMessage({ kind: 'err', text: `處理失敗：${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.card}>
      <div className={s.status}>
        <span>上次照片備份</span>
        <span className={s.statusValue}>
          {lastAt === null ? '從未備份' : days === 0 ? '今天' : `${days} 天前`}
        </span>
      </div>

      <div className={s.actions}>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const outcome = await exportPhotoBackup(new Date())
              setLastAt(await loadPhotoBackupAt())
              return { kind: outcome === 'cancelled' ? 'err' : 'ok', text: describeExport(outcome) }
            })
          }
        >
          <IconShare size={18} />
          {busy ? '處理中…' : '匯出照片備份'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <IconUpload size={18} />
          匯入照片備份
        </Button>
      </div>

      <input
        ref={fileRef}
        className={s.file}
        type="file"
        accept="application/zip,.zip"
        onChange={(e) => {
          const f = e.target.files?.[0]
          // 清掉 value，選同一個檔案兩次才會再次觸發 change
          e.target.value = ''
          if (!f) return
          void run(async () => {
            const result = await importPhotoBackup(f, new Set(students.map((x) => x.id)))
            const partial = result.ok && (result.noSpace > 0 || result.missingFile > 0)
            return { kind: result.ok && !partial ? 'ok' : 'err', text: describeImport(result) }
          })
        }}
      />

      {message && (
        <p className={`${s.result} ${message.kind === 'ok' ? s.ok : s.err}`}>{message.text}</p>
      )}
    </div>
  )
}
