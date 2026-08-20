import { formatMonth } from '../../lib/date'
import s from './charts.module.css'

/*
 * 月營收長條圖。
 *
 * 單一量測值，因此只用一個色相（品牌靛藍）；選中的月份用同色相的深階強調，
 * 不換色相，避免被誤讀成另一個類別。
 *
 * 沒有 hover tooltip：這是觸控裝置，點擊要用來做真正有用的事 ——
 * 選取月份會連動整個畫面的統計。選中月的數值直接標在長條上方。
 */

const W = 360
const H = 150
// left 需容納最寬的刻度標籤（例如「12.5萬」），太窄會把文字切掉
const PAD = { top: 18, right: 6, bottom: 22, left: 48 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BAR_GAP = 6
const RADIUS = 4

export interface MonthPoint {
  month: string
  amount: number
}

export function MonthlyBars({
  points,
  selected,
  onSelect,
}: {
  points: readonly MonthPoint[]
  selected: string
  onSelect: (month: string) => void
}) {
  const max = Math.max(...points.map((p) => p.amount), 1)
  const slot = PLOT_W / points.length
  const barW = Math.max(slot - BAR_GAP, 4)
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H

  return (
    <svg
      className={s.svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`近 ${points.length} 個月營收長條圖`}
    >
      {/* 格線只畫三條：0、中值、最大值 */}
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            className={s.grid}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(max * f)}
            y2={y(max * f)}
          />
          <text className={s.axisLabel} x={PAD.left - 6} y={y(max * f) + 3} textAnchor="end">
            {shortMoney(max * f)}
          </text>
        </g>
      ))}

      {points.map((p, i) => {
        const active = p.month === selected
        const x = PAD.left + i * slot + (slot - barW) / 2
        const top = y(p.amount)
        const h = PAD.top + PLOT_H - top
        return (
          <g key={p.month}>
            {/* 觸控目標比長條本身大，細長的長條才好點 */}
            <rect
              x={PAD.left + i * slot}
              y={PAD.top}
              width={slot}
              height={PLOT_H + PAD.bottom}
              fill="transparent"
              onClick={() => onSelect(p.month)}
              style={{ cursor: 'pointer' }}
            >
              <title>{`${formatMonth(p.month)}：${p.amount.toLocaleString('zh-TW')} 元`}</title>
            </rect>
            {p.amount > 0 && (
              <path
                className={`${s.bar} ${active ? s.barActive : ''}`}
                d={roundedTopBar(x, top, barW, h, RADIUS)}
                pointerEvents="none"
              />
            )}
            {active && p.amount > 0 && (
              <text className={s.valueLabel} x={x + barW / 2} y={top - 6}>
                {shortMoney(p.amount)}
              </text>
            )}
            <text
              className={`${s.axisLabel} ${active ? s.axisLabelActive : ''}`}
              x={x + barW / 2}
              y={H - 6}
              textAnchor="middle"
              pointerEvents="none"
            >
              {Number(p.month.slice(5))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 只有資料端（頂端）圓角；貼齊基線的一端保持方角。 */
function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h)
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ')
}

function shortMoney(v: number): string {
  if (v === 0) return '0'
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}萬`
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}
