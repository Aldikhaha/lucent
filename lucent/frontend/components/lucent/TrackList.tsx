import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Clock3 } from 'lucide-react'
import type { Track } from '../../core/types'
import { useVirtualRows } from '../../hooks/useVirtualRows'
import { usePlayer, usePlayerState, useTrackActions } from '../../state/PlayerContext'
import { usePrefs } from '../../state/PrefsContext'
import { TrackRow, TRACK_GRID_ALBUM, TRACK_GRID_LIBRARY } from './TrackRow'
import { ConfirmDialog } from './ConfirmDialog'
import { cn } from '../../lib/shadcn/utils'

interface TrackListProps {
  tracks: Track[]
  contextLabel: string
  variant?: 'library' | 'album'
  empty?: ReactNode
}

/** Virtualized track list. Double-click or Enter plays; right-click opens the track menu. */
export function TrackList({ tracks, contextLabel, variant = 'library', empty }: TrackListProps) {
  const engine = usePlayer()
  const { queue, index, status } = usePlayerState()
  const { removeTracks } = useTrackActions()
  const { prefs } = usePrefs()
  const rowHeight = prefs.compact ? 44 : 56
  const listRef = useRef<HTMLDivElement>(null)
  const { start, end } = useVirtualRows(listRef, tracks.length, rowHeight)
  const [pendingRemove, setPendingRemove] = useState<Track | null>(null)
  const currentId = queue[index] ?? null
  const isPlaying = status === 'playing' || status === 'loading'

  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  const onPlay = useCallback(
    (track: Track, position: number) => {
      if (track.id === engine.currentId) engine.toggle()
      else engine.playQueue(tracksRef.current.map((t) => t.id), position, contextLabel)
    },
    [engine, contextLabel],
  )

  const onRemove = useCallback((track: Track) => setPendingRemove(track), [])

  if (!tracks.length) return <>{empty}</>

  const rows: ReactNode[] = []
  for (let i = start; i < end; i++) {
    const t = tracks[i]
    if (!t) continue
    rows.push(
      <TrackRow
        key={t.id}
        track={t}
        position={i}
        variant={variant}
        isCurrent={t.id === currentId}
        isPlaying={isPlaying}
        style={{ top: i * rowHeight, height: rowHeight - 2 }}
        onPlay={onPlay}
        onRemove={onRemove}
      />,
    )
  }

  return (
    <div role="grid" aria-label={contextLabel} aria-rowcount={tracks.length}>
      <div
        role="row"
        className={cn(
          'lc-hairline sticky top-14 z-10 mb-1 grid items-center gap-3 border-b px-2 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-xl',
          'bg-[hsl(var(--background)/0.55)]',
          variant === 'album' ? TRACK_GRID_ALBUM : TRACK_GRID_LIBRARY,
        )}
      >
        <span className="text-center">#</span>
        <span>Title</span>
        {variant === 'library' && <span>Album</span>}
        <span className="flex justify-end" aria-label="Duration">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
        <span />
      </div>
      <div ref={listRef} className="relative" style={{ height: tracks.length * rowHeight }}>
        {rows}
      </div>
      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove from library?"
        description={
          pendingRemove
            ? `"${pendingRemove.title}" will be deleted from Lucent's storage. The original file on your PC is not affected.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemove) void removeTracks([pendingRemove.id])
          setPendingRemove(null)
        }}
      />
    </div>
  )
}
