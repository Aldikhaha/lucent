import { X } from 'lucide-react'
import { useUi } from '../../state/UiContext'
import { QueueList } from './QueueList'
import { IconButton } from './IconButton'
import { cn } from '../../lib/shadcn/utils'

/** Non-modal glass queue panel that floats over the right edge of the content area. */
export function QueuePanel() {
  const { queueOpen, setQueueOpen } = useUi()
  return (
    <aside
      aria-label="Queue"
      aria-hidden={!queueOpen}
      inert={!queueOpen}
      className={cn(
        'lc-glass-menu absolute bottom-0 right-0 top-0 z-30 flex w-[340px] flex-col rounded-[16px] transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-glass)]',
        queueOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-6 opacity-0',
      )}
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Queue</h2>
          <p className="text-xs text-muted-foreground">Up next in Lucent</p>
        </div>
        <IconButton label="Close queue" shortcut="Q" size="sm" tooltipSide="left" onClick={() => setQueueOpen(false)}>
          <X />
        </IconButton>
      </header>
      <div className="lc-scroll flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <QueueList />
      </div>
    </aside>
  )
}
