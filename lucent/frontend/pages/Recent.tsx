import { useMemo, useState } from 'react'
import { Clock, Eraser } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { plural } from '../core/format'
import { CollectionHeader, PageShell } from '../components/lucent/CollectionHeader'
import { TrackList } from '../components/lucent/TrackList'
import { ConfirmDialog } from '../components/lucent/ConfirmDialog'

export default function Recent() {
  const { tracks, clearHistory } = useLibrary()
  const [confirm, setConfirm] = useState(false)
  const recent = useMemo(
    () => tracks.filter((t) => t.lastPlayedAt).sort((a, b) => b.lastPlayedAt! - a.lastPlayedAt!),
    [tracks],
  )

  return (
    <PageShell>
      <CollectionHeader
        kind="History"
        title="Recently Played"
        meta={recent.length ? `${plural(recent.length, 'song')}, most recent first` : 'Songs you play will appear here'}
        icon={<Clock className="h-12 w-12 text-muted-foreground" strokeWidth={1.25} />}
        trackIds={recent.map((t) => t.id)}
        contextLabel="Recently Played"
        actions={
          recent.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="lc-focus ml-auto flex h-9 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.06)] hover:text-foreground"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear history
            </button>
          )
        }
      />
      <TrackList
        tracks={recent}
        contextLabel="Recently Played"
        empty={
          <div className="lc-glass rounded-[16px] px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">Nothing played yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Start a song and your listening history will build up here.</p>
          </div>
        }
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Clear listening history?"
        description="Play counts and recently played dates will be reset. Your songs stay in the library."
        confirmLabel="Clear history"
        onConfirm={() => void clearHistory()}
      />
    </PageShell>
  )
}
