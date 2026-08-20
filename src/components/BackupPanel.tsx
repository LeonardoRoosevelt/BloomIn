import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { Sheet } from './ui/Sheet'
import { IconRefresh, IconShare, IconUpload } from './icons'
import type { AppState } from '../domain/types'
import { shareFile } from '../lib/share'
import { backupFileName, buildBackup, daysSinceBackup, parseBackup } from '../store/backup'
import { clearRollback, loadRollback } from '../store/db'
import { useStore } from '../store/useStore'
import s from './BackupPanel.module.css'

interface Pending {
  state: AppState
  exportedAt: string
}

export function BackupPanel() {
  const data = useStore((st) => st.data)
  const updateSettings = useStore((st) => st.updateSettings)
  const markBackedUp = useStore((st) => st.markBackedUp)
  const importState = useStore((st) => st.importState)
  const rollbackImport = useStore((st) => st.rollbackImport)

  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [rollbackAt, setRollbackAt] = useState<string | null>(null)

  useEffect(() => {
    void loadRollback<AppState>().then((r) => setRollbackAt(r?.savedAt ?? null))
  }, [])

  const days = daysSinceBackup(data.settings.lastBackupAt, new Date())
  const stale = days === null || days > data.settings.backupReminderDays

  async function exportBackup() {
    const now = new Date()
    const payload = JSON.stringify(buildBackup(data, now), null, 2)
    const file = new File([payload], backupFileName(now), { type: 'application/json' })
    const outcome = await shareFile(file, 'BloomIn 資料備份')
    if (outcome === 'cancelled') {
      setMessage({ kind: 'err', text: '已取消，這次沒有備份。' })
      return
    }
    // 只有真的送出去才算備份完成，取消不該讓提醒消失
    markBackedUp(now.toISOString())
    setMessage({
      kind: 'ok',
      text:
        outcome === 'shared'
          ? '已送出備份檔。請確認它真的存到了「檔案」或 iCloud Drive。'
          : '已下載備份檔。',
    })
  }

  async function onFilePicked(file: File) {
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error })
      return
    }
    setMessage(null)
    setPending({ state: result.state, exportedAt: result.exportedAt })
  }

  async function confirmImport() {
    if (!pending) return
    await importState(pending.state)
    setPending(null)
    setRollbackAt(new Date().toISOString())
    setMessage({ kind: 'ok', text: '已還原。若這不是你要的檔案，可以立即復原。' })
  }

  return (
    <>
      <div className={s.card}>
        <div className={s.status}>
          <span>上次備份</span>
          <span className={`${s.statusValue} ${stale ? s.stale : ''}`}>
            {data.settings.lastBackupAt === null
              ? '從未備份'
              : days === 0
                ? '今天'
                : `${days} 天前`}
          </span>
        </div>

        <div className={s.actions}>
          <Button onClick={() => void exportBackup()}>
            <IconShare size={18} />
            匯出備份
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <IconUpload size={18} />
            匯入備份
          </Button>
        </div>

        <input
          ref={fileRef}
          className={s.file}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0]
            // 清掉 value，選同一個檔案兩次才會再次觸發 change
            e.target.value = ''
            if (f) void onFilePicked(f)
          }}
        />

        {message && (
          <p className={`${s.result} ${message.kind === 'ok' ? s.ok : s.err}`}>{message.text}</p>
        )}

        <Field
          label="提醒天數"
          hint="超過這個天數沒備份，每個畫面上方會出現常駐提醒。"
        >
          <Input
            numeric
            inputMode="numeric"
            value={String(data.settings.backupReminderDays)}
            onChange={(e) => {
              const v = e.target.value
              if (/^\d*$/.test(v)) {
                updateSettings({ backupReminderDays: v === '' ? 1 : Math.max(1, Number(v)) })
              }
            }}
          />
        </Field>

        {rollbackAt !== null && (
          <div className={s.rollback}>
            <Button
              variant="secondary"
              block
              onClick={() => {
                void rollbackImport().then((done) => {
                  setMessage(
                    done
                      ? { kind: 'ok', text: '已復原到匯入之前的資料。' }
                      : { kind: 'err', text: '找不到可復原的資料。' },
                  )
                })
              }}
            >
              <IconRefresh size={18} />
              復原到匯入之前
            </Button>
            <p className={s.rollbackNote}>
              最近一次匯入前的資料仍保留著（{new Date(rollbackAt).toLocaleString('zh-TW', { hour12: false })}）。
              確定不需要了可以
              <button
                type="button"
                style={{ color: 'var(--brand-600)', padding: '0 4px' }}
                onClick={() => {
                  void clearRollback().then(() => setRollbackAt(null))
                }}
              >
                清除
              </button>
              。
            </p>
          </div>
        )}
      </div>

      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title="確認還原"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={() => void confirmImport()}>
              覆蓋並還原
            </Button>
          </>
        }
      >
        {pending && (
          <>
            <div className={s.summary}>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>備份時間</span>
                <span>
                  {pending.exportedAt === ''
                    ? '未記錄'
                    : new Date(pending.exportedAt).toLocaleString('zh-TW', { hour12: false })}
                </span>
              </div>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>學生</span>
                <span className={s.summaryValue}>{pending.state.students.length} 位</span>
              </div>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>課程</span>
                <span className={s.summaryValue}>{pending.state.sessions.length} 堂</span>
              </div>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>出席紀錄</span>
                <span className={s.summaryValue}>{pending.state.attendances.length} 筆</span>
              </div>
            </div>
            <p className={s.warn}>
              目前裝置上的 {data.students.length} 位學生、{data.sessions.length} 堂課、
              {data.attendances.length} 筆出席紀錄會被<strong>完全取代</strong>。
              現況會先存成回復點，還原後仍可復原。
            </p>
          </>
        )}
      </Sheet>
    </>
  )
}
