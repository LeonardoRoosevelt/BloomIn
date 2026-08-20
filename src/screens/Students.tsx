import { ScreenHeader } from '../components/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { Easel } from '../components/illustrations/Easel'

export function Students() {
  return (
    <>
      <ScreenHeader title="學生" />
      <EmptyState art={<Easel />} title="學生尚未實作" description="Phase 2 只建立版面骨架，內容於後續階段填入。" />
    </>
  )
}
