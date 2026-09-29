import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { IconShare, IconUpload } from './icons'
import { daysSinceBackup } from '../store/backup'
import { shareFile } from '../lib/share'
import { loadPhotoBackupTime, savePhotoBackupTime } from '../store/db'
import {
  buildPhotoBackup,
  describeExport,
  describeImport,
  importPhotoBackup,
  type PhotoBackupScope,
} from '../store/photoBackup'
import { countPhotosByStudent, listStudentPhotosWithBlobs } from '../store/photos'
import { useStore } from '../store/useStore'
// 與資料備份同一種卡片外觀，直接共用樣式
import s from './BackupPanel.module.css'
import p from './PhotoBackupPanel.module.css'

interface OwnerRow {
  owner: string
  label: string
  count: number
  lastAt: string | null
  scope: PhotoBackupScope
}

/**
 * 照片備份：與資料備份分開的 zip，逐位學生匯出。
 *
 * 一次匯出全部照片會讓單一 zip 大到 iOS 撐不住，所以拆成每位學生一份；
 * iOS 每次分享都需要使用者親手點，因此每列各自一個匯出按鈕，而不是一鍵全部。
 * 匯入只做合併，絕不覆蓋本機照片，所以不需要像資料備份那樣先確認再覆蓋。
 */
export function PhotoBackupPanel() {
  const students = useStore((st) => st.data.students)
  const fileRef = useRef<HTMLInputElement>(null)
  // null = 尚未載入
  const [rows, setRows] = useState<OwnerRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const reload = useCallback(async () => {
    const counts = await countPhotosByStudent()
    const withPhotos = students.filter((st) => (counts.get(st.id) ?? 0) > 0)
    setRows(
      await Promise.all(
        withPhotos.map(async (st) => ({
          owner: st.id,
          label: st.name,
          count: counts.get(st.id) ?? 0,
          lastAt: await loadPhotoBackupTime(st.id),
          scope: { kind: 'student', studentId: st.id, studentName: st.name } as const,
        })),
      ),
    )
  }, [students])

  useEffect(() => {
    void reload()
  }, [reload])

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

  function exportRow(row: OwnerRow) {
    void run(async () => {
      const now = new Date()
      const photos = await listStudentPhotosWithBlobs(row.owner)
      const file = await buildPhotoBackup(photos, now, row.scope)
      const outcome = await shareFile(file, `BloomIn 照片備份（${row.label}）`)
      // 只有真的送出去才算備份完成；取消了還記時間，會讓人以為照片已經有備份
      if (outcome !== 'cancelled') await savePhotoBackupTime(row.owner, now.toISOString())
      await reload()
      return { kind: outcome === 'cancelled' ? 'err' : 'ok', text: describeExport(outcome) }
    })
  }

  return (
    <div className={s.card}>
      {rows !== null && rows.length === 0 && (
        <p className={p.empty}>還沒有任何照片。在學生的「照片紀錄本」新增照片後，這裡可以逐位學生匯出備份。</p>
      )}
      {rows !== null && rows.length > 0 && (
        <ul className={p.list}>
          {rows.map((row) => (
            <li key={row.owner} className={p.row}>
              <span className={p.body}>
                <span className={p.name}>{row.label}</span>
                <span className={p.meta}>
                  {row.count} 張 · {lastBackupLabel(row.lastAt)}
                </span>
              </span>
              <Button
                variant="secondary"
                iconOnly
                aria-label={`匯出${row.label}的照片備份`}
                disabled={busy}
                onClick={() => exportRow(row)}
              >
                <IconShare size={18} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.actions}>
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <IconUpload size={18} />
          {busy ? '處理中…' : '匯入照片備份'}
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
            await reload()
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

function lastBackupLabel(lastAt: string | null): string {
  const days = daysSinceBackup(lastAt, new Date())
  if (days === null) return '從未備份'
  return days === 0 ? '今天' : `${days} 天前`
}
