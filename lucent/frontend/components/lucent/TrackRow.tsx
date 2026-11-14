import { memo, type CSSProperties } from 'react'
import { MoreHorizontal, Play } from 'lucide-react'
import type { Track } from '../../core/types'
import { formatTime } from '../../core/format'
import { Artwork } from './Artwork'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../../lib/shadcn/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../lib/shadcn/dropdown-menu'
import { menuContentClass, menuDestructiveClass, menuItemClass, useTrackMenuActions } from './trackMenu'
import { cn } from '../../lib/shadcn/utils'

export const TRACK_GRID_LIBRARY = 'grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_3.5rem_2.25rem]'
export const TRACK_GRID_ALBUM = 'grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_2.25rem]'

interface TrackRowProps {
  track: Track
  position: number
  variant: 'library' | 'album'
  isCurrent: boolean
  isPlaying: boolean
  style: CSSProperties
  onPlay: (track: Track, position: number) => void
  onRemove: (track: Track) => void
}

function TrackRowImpl({ track, position, variant, isCurrent, isPlaying, style, onPlay, onRemove }: TrackRowProps) {
  const actions = useTrackMenuActions(track, {
    isCurrent,
    isPlaying,
    onPlay: () => onPlay(track, position),
    onRemove: () => onRemove(track),
  })
  const number = variant === 'album' ? (track.trackNo ?? position + 1) : position + 1

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="row"
          tabIndex={0}
          aria-selected={isCurrent}
          style={style}
          onDoubleClick={() => onPlay(track, position)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onPlay(track, position)
            }
          }}
          className={cn(
            'lc-focus group absolute left-0 right-0 grid items-center gap-3 rounded-[10px] px-2 text-[13px] transition-colors duration-100 focus-visible:outline-offset-[-2px]',
            variant === 'album' ? TRACK_GRID_ALBUM : TRACK_GRID_LIBRARY,
            isCurrent ? 'lc-active' : 'lc-hover',
          )}
        >
          <div className="relative flex h-full items-center justify-center text-muted-foreground">
            {isCurrent ? (
              <span className="lc-eq group-hover:hidden" data-playing={isPlaying}>
                <span />
                <span />
                <span />
              </span>
            ) : (
              <span className="lc-tabular text-xs group-hover:hidden">{number}</span>
            )}
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Play ${track.title}`}
              onClick={() => onPlay(track, position)}
              className="hidden h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-[hsl(var(--lc-hover)/0.1)] group-hover:flex"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {variant === 'library' && (
              <Artwork artworkId={track.artworkId} className="h-10 w-10 rounded-md [.lc-compact_&]:h-8 [.lc-compact_&]:w-8" />
            )}
            <div className="min-w-0">
              <div className={cn('truncate font-medium', isCurrent ? 'lc-accent-text' : 'text-foreground')}>{track.title}</div>
              <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
            </div>
          </div>

          {variant === 'library' && <div className="truncate text-muted-foreground">{track.album}</div>}

          <div className="lc-tabular text-right text-xs text-muted-foreground">{formatTime(track.duration)}</div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More options for ${track.title}`}
                className="lc-focus flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-[hsl(var(--lc-hover)/0.1)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={menuContentClass}>
              {actions.map((a) => (
                <div key={a.key}>
                  {a.separatorBefore && <DropdownMenuSeparator className="mx-1 my-1 bg-[hsl(var(--lc-stroke)/0.08)]" />}
                  <DropdownMenuItem onSelect={a.run} className={cn(menuItemClass, a.destructive && menuDestructiveClass)}>
                    <a.icon className="h-4 w-4" />
                    {a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menuContentClass}>
        {actions.map((a) => (
          <div key={a.key}>
            {a.separatorBefore && <ContextMenuSeparator className="mx-1 my-1 bg-[hsl(var(--lc-stroke)/0.08)]" />}
            <ContextMenuItem onSelect={a.run} className={cn(menuItemClass, a.destructive && menuDestructiveClass)}>
              <a.icon className="h-4 w-4" />
              {a.label}
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const TrackRow = memo(TrackRowImpl)
