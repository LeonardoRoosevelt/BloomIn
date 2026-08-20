import { useState } from 'react'
import { ScreenHeader } from '../components/AppShell'
import { Easel } from '../components/illustrations/Easel'
import { SessionCard } from '../components/SessionCard'
import { SessionForm } from '../components/SessionForm'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { IconPlus } from '../components/icons'
import { sessionsOnDate } from '../domain/selectors'
import { formatDateLong, todayISO } from '../lib/date'
import { navigate } from '../lib/router'
import { useStore } from '../store/useStore'
import s from './Today.module.css'

export function Today() {
  const data = useStore((st) => st.data)
  const [creating, setCreating] = useState(false)
  const today = todayISO()
  const sessions = sessionsOnDate(data, today)

  return (
    <>
      <ScreenHeader
        title="今日"
        actions={
          <Button iconOnly aria-label="新增課程" onClick={() => setCreating(true)}>
            <IconPlus size={22} />
          </Button>
        }
      />
      <p className={s.subtitle}>{formatDateLong(today)}</p>

      {sessions.length === 0 ? (
        <EmptyState
          art={<Easel />}
          title="今天還沒有課"
          description="建立今天的課程後，就能開始點名並自動計算學費。"
          action={
            <Button onClick={() => setCreating(true)}>
              <IconPlus size={20} />
              新增課程
            </Button>
          }
        />
      ) : (
        <div className={s.list}>
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      <SessionForm
        open={creating}
        session={null}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate({ name: 'session', id })}
      />
    </>
  )
}
