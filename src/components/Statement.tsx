import { formatMinutes } from '../domain/billing'
import { statusText, type Statement } from '../domain/reports'
import type { Settings } from '../domain/types'
import { formatDate, formatMonth } from '../lib/date'

/**
 * 月結單版面。純呈現，數字全部來自出席紀錄的快照。
 * 樣式在 statementStyles.ts，由呼叫端注入。
 */
export function StatementSheet({
  statements,
  settings,
  generatedAt,
}: {
  statements: readonly Statement[]
  settings: Settings
  generatedAt: Date
}) {
  return (
    <div className="statement-sheet">
      {statements.map((st) => (
        <StatementPage
          key={st.student.id}
          statement={st}
          settings={settings}
          generatedAt={generatedAt}
        />
      ))}
    </div>
  )
}

function StatementPage({
  statement,
  settings,
  generatedAt,
}: {
  statement: Statement
  settings: Settings
  generatedAt: Date
}) {
  const { student, lines, totalMinutes, totalAmount, presentCount } = statement
  return (
    <section className="statement">
      <header className="st-head">
        <div>
          <div className="st-studio">{settings.studioName === '' ? '美術班' : settings.studioName}</div>
          {settings.teacherName !== '' && <div className="st-teacher">授課老師：{settings.teacherName}</div>}
        </div>
        <div>
          <div className="st-title">學費明細</div>
          <div className="st-period">{formatMonth(statement.month)}</div>
        </div>
      </header>

      <div className="st-who">
        <span className="st-name">{student.name}</span>
        {student.phone !== '' && <span className="st-phone">{student.phone}</span>}
        {student.guardianName !== '' && (
          <span className="st-phone">
            家長：{student.guardianName}
            {student.guardianPhone !== '' && `　${student.guardianPhone}`}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="st-empty">本月沒有上課紀錄。</p>
      ) : (
        <table className="st-table">
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '29%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>日期</th>
              <th>課程</th>
              <th className="st-time">時間</th>
              <th>狀態</th>
              <th className="st-num">時數</th>
              <th className="st-num">時薪</th>
              <th className="st-num">金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.date}-${i}`}>
                <td>{formatDate(l.date)}</td>
                <td>
                  {l.courseName}
                  {l.topic !== '' && <div className="st-topic">{l.topic}</div>}
                </td>
                <td className="st-time">{l.timeRange}</td>
                <td className={l.amount === 0 ? 'st-muted' : undefined}>{statusText(l.status)}</td>
                <td className="st-num">{l.minutes === 0 ? '—' : formatMinutes(l.minutes)}</td>
                <td className="st-num">{l.amount === 0 ? '—' : l.rate.toLocaleString('zh-TW')}</td>
                <td className="st-num">{l.amount.toLocaleString('zh-TW')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="st-total">
        <span className="st-total-label">
          出席 {presentCount} 堂　計費 {formatMinutes(totalMinutes)}
        </span>
        <span className="st-total-value">NT${totalAmount.toLocaleString('zh-TW')}</span>
      </div>

      <footer className="st-foot">
        <span>產生時間：{generatedAt.toLocaleString('zh-TW', { hour12: false })}</span>
        <span>BloomIn</span>
      </footer>
    </section>
  )
}
