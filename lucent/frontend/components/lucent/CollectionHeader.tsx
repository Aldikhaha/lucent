import type { ReactNode } from 'react'
import { Pause, Play, Shuffle } from 'lucide-react'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { Artwork } from './Artwork'
import { cn } from '../../lib/shadcn/utils'

interface CollectionHeaderProps {
  kind: string
  title: string
  subtitle?: ReactNode
  meta: string
  artworkId?: string | null
  icon?: ReactNode
  trackIds: string[]
  contextLabel: string
  actions?: ReactNode
}

/** Restrained header for albums, folders and library views: cover, title, meta, Play / Shuffle. */
export function CollectionHeader({
  kind,
  title,
  subtitle,
  meta,
  artworkId,
  icon,
  trackIds,
  contextLabel,
  actions,
}: CollectionHeaderProps) {
  const engine = usePlayer()
  const { contextLabel: playingLabel, status } = usePlayerState()
  const isThis = playingLabel === contextLabel
  const playing = isThis && (status === 'playing' || status === 'loading')
  const showCover = artworkId !== undefined || icon

  return (
    <header className="flex items-end gap-7 pb-7 pt-2">
      {showCover &&
        (icon ? (
          <div className="lc-glass flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-[18px]">{icon}</div>
        ) : (
          <Artwork
            artworkId={artworkId ?? null}
            eager
            className="h-[168px] w-[168px] rounded-[18px] shadow-[0_24px_48px_-24px_hsl(var(--lc-shadow)/0.8),0_4px_12px_-4px_hsl(var(--lc-shadow)/0.3)] [.lc-compact_&]:h-[128px] [.lc-compact_&]:w-[128px]"
          />
        ))}
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{kind}</div>
        <h1 className="mt-1.5 truncate text-[32px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle && <div className="mt-1 truncate text-[15px] text-foreground/80">{subtitle}</div>}
        <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            disabled={!trackIds.length}
            onClick={() => (isThis ? engine.toggle() : engine.playQueue(trackIds, 0, contextLabel, false))}
            className="lc-focus flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            {playing ? 'Pause' : isThis ? 'Resume' : 'Play'}
          </button>
          <button
            type="button"
            disabled={!trackIds.length}
            onClick={() => engine.playQueue(trackIds, 0, contextLabel, true)}
            className="lc-focus lc-glass flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.08)] disabled:opacity-40"
          >
            <Shuffle className="h-4 w-4" />
            Shuffle
          </button>
          {actions}
        </div>
      </div>
    </header>
  )
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('lc-view-enter mx-auto w-full max-w-[1280px] px-7 pb-10', className)}>{children}</div>
}
