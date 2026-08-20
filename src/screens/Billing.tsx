import { useMemo, useState } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { MonthlyBars, type MonthPoint } from '../components/charts/MonthlyBars'
import { RankBars, type RankRow } from '../components/charts/RankBars'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTiles } from '../components/ui/StatTiles'
import { IconBilling } from '../components/icons'
import { formatMinutes } from '../domain/billing'
import {
  attendanceRate,
  recentMonths,
  recordsInMonth,
  totalsByCourseType,
  totalsByStudent,
  totalsOf,
} from '../domain/selectors'
import { accentVar } from '../lib/accent'
import { formatMonth, todayISO } from '../lib/date'
import { formatMoney } from '../lib/format'
import { useStore } from '../store/useStore'
import c from '../components/charts/charts.module.css'
import s from './Billing.module.css'

/** 長條圖顯示的月份數。六個月在手機寬度下每根仍夠寬可點。 */
const MONTHS_SHOWN = 6

export function Billing() {
  const data = useStore((st) => st.data)
  const thisMonth = todayISO().slice(0, 7)
  const [selected, setSelected] = useState(thisMonth)

  const months = useMemo(() => recentMonths(thisMonth, MONTHS_SHOWN), [thisMonth])

  const points: MonthPoint[] = useMemo(
    () =>
      months.map((month) => ({
        month,
        amount: totalsOf(recordsInMonth(data, month)).amount,
      })),
    [data, months],
  )

  const records = useMemo(() => recordsInMonth(data, selected), [data, selected])
  const totals = totalsOf(records)
  const rate = attendanceRate(totals)

  const courseRows: RankRow[] = useMemo(() => {
    const groups = totalsByCourseType(data, records)
    const sum = groups.reduce((n, g) => n + g.totals.amount, 0)
    return groups.map((g) => ({
      key: g.courseType?.id ?? 'unknown',
      label: g.courseType?.name ?? '已刪除的課程',
      value: g.totals.amount,
      valueText: formatMoney(g.totals.amount),
      sub: `${formatMinutes(g.totals.minutes)}　佔 ${sum === 0 ? 0 : Math.round((g.totals.amount / sum) * 100)}%`,
      ...(g.courseType ? { color: accentVar(g.courseType.accent) } : {}),
    }))
  }, [data, records])

  const studentRows: RankRow[] = useMemo(
    () =>
      totalsByStudent(data, records).map((g) => ({
        key: g.student.id,
        label: g.student.name,
        value: g.totals.amount,
        valueText: formatMoney(g.totals.amount),
        sub: `${formatMinutes(g.totals.minutes)}　出席 ${g.totals.presentCount}/${g.totals.recordCount} 堂`,
      })),
    [data, records],
  )

  const hasAnyData = points.some((p) => p.amount > 0)

  return (
    <>
      <ScreenHeader title="帳務" />

      {!hasAnyData ? (
        <EmptyState
          art={<IconBilling size={72} />}
          title="還沒有可統計的資料"
          description="完成幾堂課的點名後，這裡會顯示營收趨勢、課程佔比與學生排行。"
        />
      ) : (
        <div className={s.split}>
          <section className={c.figure}>
            <div className={s.figureTitle}>近 {MONTHS_SHOWN} 個月營收</div>
            <p className={c.caption}>點選長條可切換下方統計的月份。</p>
            <MonthlyBars points={points} selected={selected} onSelect={setSelected} />
          </section>

          <section>
            <div className={s.monthTitle}>
              <span className={s.monthName}>{formatMonth(selected)}</span>
              {selected === thisMonth && <span className={s.hint}>本月</span>}
            </div>
            <StatTiles
              stats={[
                { label: '營收', value: totals.amount.toLocaleString('zh-TW') },
                { label: '上課時數', value: (totals.minutes / 60).toFixed(1) },
                { label: '出席率', value: rate === null ? '—' : `${Math.round(rate * 100)}%` },
              ]}
            />
          </section>

          <section className={c.figure}>
            <div className={s.figureTitle}>課程類型收入</div>
            <p className={c.caption}>依金額排序，含佔比。</p>
            <RankBars rows={courseRows} emptyText="這個月還沒有出席紀錄。" />
          </section>

          <section className={c.figure}>
            <div className={s.figureTitle}>學生收入排行</div>
            <p className={c.caption}>單一量測值，因此所有長條同色。</p>
            <RankBars rows={studentRows} emptyText="這個月還沒有出席紀錄。" />
          </section>
        </div>
      )}
    </>
  )
}
