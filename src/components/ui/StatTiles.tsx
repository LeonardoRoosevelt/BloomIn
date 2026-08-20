import s from './StatTiles.module.css'

export interface Stat {
  label: string
  value: string
}

/** 三格數字摘要。純數字沒有比較關係，畫成圖表只會比文字更難讀。 */
export function StatTiles({ stats }: { stats: readonly Stat[] }) {
  return (
    <div className={s.grid}>
      {stats.map((st) => (
        <div className={s.tile} key={st.label}>
          <div className={s.value}>{st.value}</div>
          <div className={s.label}>{st.label}</div>
        </div>
      ))}
    </div>
  )
}
