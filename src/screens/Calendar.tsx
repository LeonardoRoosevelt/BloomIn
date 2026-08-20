import { ScreenHeader } from '../components/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { Easel } from '../components/illustrations/Easel'

export function Calendar() {
  return (
    <>
      <ScreenHeader title="課表" />
      <EmptyState art={<Easel />} title="課表尚未實作" description="Phase 2 只建立版面骨架，內容於後續階段填入。" />
    </>
  )
}
