import { useState, type CSSProperties } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { BackupPanel } from '../components/BackupPanel'
import { OfflineStatus } from '../components/OfflineStatus'
import { CourseTypeForm } from '../components/CourseTypeForm'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { SegmentedControl, type Segment } from '../components/ui/SegmentedControl'
import { IconChevronRight, IconPlus } from '../components/icons'
import { sessionCountForCourseType } from '../domain/selectors'
import type { CourseType, Rounding } from '../domain/types'
import { accentVar } from '../lib/accent'
import { formatMoney } from '../lib/format'
import { useStore } from '../store/useStore'
import s from './Settings.module.css'

const ROUNDING: readonly Segment<Rounding>[] = [
  { value: 'exact', label: '實際分鐘' },
  { value: 'nearest15', label: '15 分' },
  { value: 'nearest30', label: '30 分' },
]

export function Settings() {
  const data = useStore((st) => st.data)
  const updateSettings = useStore((st) => st.updateSettings)
  const [editing, setEditing] = useState<CourseType | null>(null)
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const { settings, courseTypes } = data
  const archivedCount = courseTypes.filter((c) => c.archived).length
  const visible = courseTypes.filter((c) => showArchived || !c.archived)

  return (
    <>
      <ScreenHeader title="設定" />

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>工作室資訊</h2>
        </div>
        <div className={s.card}>
          <Field label="工作室名稱" hint="會印在月結單抬頭。">
            <Input
              value={settings.studioName}
              placeholder="例如：小花美術教室"
              onChange={(e) => updateSettings({ studioName: e.target.value })}
            />
          </Field>
          <Field label="老師姓名">
            <Input
              value={settings.teacherName}
              onChange={(e) => updateSettings({ teacherName: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>計費</h2>
        </div>
        <div className={s.card}>
          <Field
            label="預設時薪"
            hint="課程類型與學生都沒有設定時，才會用到這個值。"
          >
            <Input
              numeric
              inputMode="numeric"
              value={String(settings.defaultHourlyRate)}
              onChange={(e) => {
                const v = e.target.value
                if (/^\d*$/.test(v)) updateSettings({ defaultHourlyRate: v === '' ? 0 : Number(v) })
              }}
            />
          </Field>

          <span className={s.roundingLabel}>時數進位</span>
          <SegmentedControl
            ariaLabel="時數進位規則"
            segments={ROUNDING}
            value={settings.rounding}
            onChange={(rounding) => updateSettings({ rounding })}
          />
        </div>
        <p className={s.note}>
          四捨五入，不是無條件進位 —— 遲到 5 分鐘不會被多算半小時。
          <br />
          調整這裡<strong>不會</strong>改動已經點過名的金額。已結算的紀錄保留當時的費率，
          否則過去的月結單會跟著被改寫。
        </p>
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>課程類型</h2>
          <Button variant="ghost" iconOnly aria-label="新增課程類型" onClick={() => setCreating(true)}>
            <IconPlus size={20} />
          </Button>
        </div>

        <div className={s.list}>
          {visible.map((c) => {
            const used = sessionCountForCourseType(data, c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`${s.typeRow} ${c.archived ? s.archived : ''}`}
                onClick={() => setEditing(c)}
              >
                <span className={s.dot} style={{ '--dot': accentVar(c.accent) } as CSSProperties} />
                <span className={s.typeBody}>
                  <span className={s.typeName}>
                    {c.name}
                    {c.archived && '（已封存）'}
                  </span>
                  <span className={s.typeMeta}>
                    {formatMoney(c.hourlyRate)} / 小時
                    {c.chargeOnAbsence && '　缺席照收'}
                    {used > 0 && `　${used} 堂課使用中`}
                  </span>
                </span>
                <IconChevronRight size={18} />
              </button>
            )
          })}
        </div>

        {archivedCount > 0 && (
          <div className={s.archivedToggle}>
            <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? '隱藏已封存' : `顯示已封存（${archivedCount}）`}
            </Button>
          </div>
        )}
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>離線狀態</h2>
        </div>
        <OfflineStatus />
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>資料</h2>
        </div>
        <BackupPanel />
        <p className={s.note}>
          資料只存在這台裝置。<strong>刪除主畫面圖示或清除網站資料，紀錄會一起消失且無法復原。</strong>
          匯出的備份檔請存到 iCloud Drive 或另一台裝置。
        </p>
      </section>

      <CourseTypeForm open={creating} courseType={null} onClose={() => setCreating(false)} />
      <CourseTypeForm
        open={editing !== null}
        courseType={editing}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
