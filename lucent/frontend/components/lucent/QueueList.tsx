import { X } from 'lucide-react'
import { useLibrary } from '../../state/LibraryContext'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { formatTime } from '../../core/format'
import { Artwork } from './Artwork'
import { cn } from '../../lib/shadcn/utils'

function QueueRow({
  id,
  index,
  current,
  playing,
  onRemove,
}: {
  id: string
  index: number
  current?: boolean
  playing?: boolean
  onRemove?: () => void
}) {
  const engine = usePlayer()
  const { byId } = useLibrary()
  const t = byId.get(id)
  if (!t) return null
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors',
        current ? 'lc-active' : 'lc-hover',
      )}
    >
      <button
        type="button"
        onClick={() => !current && engine.jumpTo(index)}
        className="lc-focus flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
        aria-label={current ? `Now playing: ${t.title}` : `Play ${t.title}`}
      >
        <Artwork artworkId={t.artworkId} className="h-9 w-9 rounded-md" />
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[13px]', current ? 'lc-accent-text font-medium' : 'text-foreground')}>
            {t.title}
          </div>
          <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
        </div>
      </button>
      {current ? (
        <span className="lc-eq mr-1" data-playing={playing}>
          <span />
          <span />
          <span />
        </span>
      ) : (
        <>
          <span className="lc-tabular text-xs text-muted-foreground group-hover:hidden">{formatTime(t.duration)}</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${t.title} from queue`}
            className="lc-focus hidden h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--lc-hover)/0.08)] hover:text-foreground focus-visible:flex group-hover:flex"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

/** "Now playing" + "Up next" list with jump and remove. */
export function QueueList() {
  const engine = usePlayer()
  const { queue, index, status, contextLabel, repeat } = usePlayerState()
  const upcoming = queue.slice(index + 1)
  const previous = queue.slice(0, index)

  if (index < 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Queue is empty</p>
        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">Play a song or use "Add to queue" from any track menu.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-xs text-muted-foreground">Playback queue · {queue.length} songs. Saved playlists are managed separately.</p>
      {previous.length > 0 && <section>
        <h3 className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Played</h3>
        {previous.map((id, i) => <QueueRow key={id} id={id} index={i} onRemove={() => engine.removeFromQueue(i)} />)}
      </section>}
      <section>
        <h3 className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Now playing</h3>
        <QueueRow id={queue[index]!} index={index} current playing={status === 'playing'} />
      </section>
      <section>
        <div className="mb-1.5 flex items-center justify-between px-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Up next{contextLabel ? ` · ${contextLabel}` : ''}
          </h3>
          {upcoming.length > 0 && (
            <button
              type="button"
              onClick={() => engine.clearUpcoming()}
              className="lc-focus rounded px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {upcoming.length ? (
          <div className="flex flex-col">
            {upcoming.map((id, i) => (
              <QueueRow key={id} id={id} index={index + 1 + i} onRemove={() => engine.removeFromQueue(index + 1 + i)} />
            ))}
          </div>
        ) : (
          <p className="px-2 text-xs text-muted-foreground">
            {repeat === 'all' ? 'The queue will start over from the beginning.' : 'Nothing else queued.'}
          </p>
        )}
      </section>
    </div>
  )
}
