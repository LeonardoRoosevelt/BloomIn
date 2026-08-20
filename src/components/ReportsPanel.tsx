import { useEffect, useRef, useState } from 'react'
import { PrintPortal } from './PrintPortal'
import { StatementSheet } from './Statement'
import { STATEMENT_CSS } from './statementStyles'
import { Button } from './ui/Button'
import { Field, Select } from './ui/Field'
import { IconDownload, IconPrinter } from './icons'
import {
  ATTENDANCE_CSV_HEADERS,
  SUMMARY_CSV_HEADERS,
  attendanceCsvRows,
  buildStatements,
  summaryCsvRows,
  type Statement,
} from '../domain/reports'
import { csvFile, toCsv } from '../lib/csv'
import { formatMonth } from '../lib/date'
import { shareFile } from '../lib/share'
import { useStore } from '../store/useStore'
import s from './ReportsPanel.module.css'

const ALL = '__all__'

export function ReportsPanel({ month }: { month: string }) {
  const data = useStore((st) => st.data)
  const [target, setTarget] = useState<string>(ALL)
  const [statements, setStatements] = useState<Statement[] | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const available = buildStatements(data, month)
  // 月份一換，先前選定的學生可能這個月沒有紀錄
  const targetValid = target === ALL || available.some((st) => st.student.id === target)
  const effectiveTarget = targetValid ? target : ALL

  // 換月份或換對象後，先前備妥的月結單就過期了。
  // 不清掉的話，使用者直接按瀏覽器列印會印出上一個月的內容。
  useEffect(() => {
    setStatements(null)
  }, [month, effectiveTarget])

  useEffect(() => {
    if (statements === null) return
    // 等瀏覽器把月結單畫出來再叫列印，否則預覽會是空白
    const id = requestAnimationFrame(() => window.print())
    return () => cancelAnimationFrame(id)
    // 內容留在畫面上不清除：iOS 的 window.print() 可能立刻返回，
    // 太早移除節點會讓列印預覽變成空白。
  }, [statements])

  function prepare(): Statement[] {
    return effectiveTarget === ALL
      ? available
      : buildStatements(data, month, [effectiveTarget])
  }

  function print() {
    const next = prepare()
    if (next.length === 0) {
      setMessage({ kind: 'err', text: '這個月沒有可列印的紀錄。' })
      return
    }
    setMessage(null)
    setStatements(next)
  }

  /**
   * 備援：把月結單開在新分頁再列印。
   * window.print() 在部分 iOS 版本的 standalone 模式下不會有反應，
   * 此時從 Safari 分頁列印是可行的路徑。
   */
  function openInNewTab() {
    const next = prepare()
    if (next.length === 0) {
      setMessage({ kind: 'err', text: '這個月沒有可列印的紀錄。' })
      return
    }
    setStatements(next)
    requestAnimationFrame(() => {
      const html = printRef.current?.innerHTML
      if (html === undefined) return
      const win = window.open('', '_blank')
      if (!win) {
        setMessage({ kind: 'err', text: '瀏覽器擋下了新分頁，請允許彈出視窗後再試。' })
        return
      }
      win.document.write(
        `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">` +
          `<title>${formatMonth(month)} 學費明細</title><style>${STATEMENT_CSS}</style></head>` +
          `<body>${html}</body></html>`,
      )
      win.document.close()
    })
  }

  async function exportCsv(kind: 'detail' | 'summary') {
    const [headers, rows, name] =
      kind === 'detail'
        ? [ATTENDANCE_CSV_HEADERS, attendanceCsvRows(data, month), `出席明細-${month}.csv`]
        : [SUMMARY_CSV_HEADERS, summaryCsvRows(data, month), `月度彙總-${month}.csv`]

    if (rows.length === 0) {
      setMessage({ kind: 'err', text: '這個月沒有可匯出的紀錄。' })
      return
    }
    const file = csvFile(name, toCsv(headers, rows))
    const outcome = await shareFile(file, name)
    setMessage(
      outcome === 'cancelled'
        ? { kind: 'err', text: '已取消匯出。' }
        : { kind: 'ok', text: `已產生 ${name}（${rows.length} 列）。` },
    )
  }

  if (available.length === 0) {
    return <p className={s.empty}>{formatMonth(month)} 沒有出席紀錄，無法產生報表。</p>
  }

  return (
    <>
      <div className={s.card}>
        <Field label="月結單對象">
          <Select value={effectiveTarget} onChange={(e) => setTarget(e.target.value)}>
            <option value={ALL}>全部學生（{available.length} 位）</option>
            {available.map((st) => (
              <option key={st.student.id} value={st.student.id}>
                {st.student.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className={s.actions}>
          <Button block onClick={print}>
            <IconPrinter size={18} />
            列印 {formatMonth(month)} 月結單
          </Button>

          <div className={s.csvRow}>
            <Button variant="secondary" onClick={() => void exportCsv('detail')}>
              <IconDownload size={18} />
              出席明細 CSV
            </Button>
            <Button variant="secondary" onClick={() => void exportCsv('summary')}>
              <IconDownload size={18} />
              月度彙總 CSV
            </Button>
          </div>
        </div>

        {message && (
          <p className={`${s.result} ${message.kind === 'ok' ? s.ok : s.err}`}>{message.text}</p>
        )}

        <p className={s.note}>
          列印預覽裡選「儲存到檔案」即可存成 PDF。
          若按了沒有反應（部分 iOS 版本會這樣），改用
          <button type="button" className={s.link} onClick={openInNewTab}>
            在新分頁開啟
          </button>
          後再從瀏覽器列印。
        </p>
      </div>

      {statements !== null && (
        <PrintPortal>
          <div ref={printRef}>
            <StatementSheet
              statements={statements}
              settings={data.settings}
              generatedAt={new Date()}
            />
          </div>
        </PrintPortal>
      )}
    </>
  )
}
