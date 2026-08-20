import type { CSSProperties, ReactNode } from 'react'
import s from './charts.module.css'

/*
 * 橫向排行長條。
 *
 * 刻意用 HTML/CSS 而非 SVG 畫長條：每一列都要有中文標籤與可靠的截斷，
 * 那是 HTML 排版擅長而 SVG <text> 做不好的事；長條本身只是矩形，用 SVG 沒有好處。
 * 色值與尺寸仍取自同一組 token，所以與其他圖表是同一套視覺語言。
 *
 * 每一列都直接標註名稱與數值 —— 六色 accent 在色盲下無法兩兩皆可分辨，
 * 因此顏色只是輔助辨識，識別永遠由文字承擔。
 */

export interface RankRow {
  key: string
  label: ReactNode
  /** 決定長條長度的數值 */
  value: number
  /** 右側顯示的主要數值文字 */
  valueText: string
  /** 標籤下方的補充說明（時數、佔比等） */
  sub?: string
  /** CSS 色值，未指定則用品牌色 */
  color?: string
}

export function RankBars({ rows, emptyText }: { rows: readonly RankRow[]; emptyText: string }) {
  if (rows.length === 0) return <p className={s.empty}>{emptyText}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className={s.rows}>
      {rows.map((r) => (
        <div className={s.row} key={r.key}>
          <span className={s.rowLabel}>{r.label}</span>
          <span className={s.rowValue}>{r.valueText}</span>
          <div className={s.track}>
            <div
              className={s.fill}
              style={
                {
                  width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`,
                  '--bar-color': r.color ?? 'var(--brand-600)',
                } as CSSProperties
              }
            />
          </div>
          {r.sub !== undefined && <span className={s.rowSub}>{r.sub}</span>}
        </div>
      ))}
    </div>
  )
}
