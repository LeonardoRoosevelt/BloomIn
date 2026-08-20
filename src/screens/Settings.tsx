import { ScreenHeader } from '../components/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { Easel } from '../components/illustrations/Easel'

export function Settings() {
  return (
    <>
      <ScreenHeader title="設定" />
      <EmptyState art={<Easel />} title="設定尚未實作" description="Phase 2 只建立版面骨架，內容於後續階段填入。" />
    </>
  )
}
