import { Link } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import type { Album } from '../../core/types'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { Artwork } from './Artwork'
import { cn } from '../../lib/shadcn/utils'

export function AlbumCard({ album, className }: { album: Album; className?: string }) {
  const engine = usePlayer()
  const { queue, index, status, contextLabel } = usePlayerState()
  const label = `Album · ${album.title}`
  const isThis = contextLabel === label && album.trackIds.includes(queue[index] ?? '')
  const playing = isThis && (status === 'playing' || status === 'loading')

  return (
    <div className={cn('group min-w-0', className)}>
      <div className="relative transition-transform duration-300 [transition-timing-function:var(--ease-glass)] group-hover:-translate-y-0.5">
        <Link to={`/albums/${album.id}`} className="lc-focus block rounded-[14px]" aria-label={`${album.title} by ${album.artist}`}>
          <Artwork
            artworkId={album.artworkId}
            className="aspect-square w-full rounded-[14px] shadow-[0_10px_24px_-14px_hsl(var(--lc-shadow)/0.7)]"
          />
        </Link>
        <button
          type="button"
          aria-label={playing ? `Pause ${album.title}` : `Play ${album.title}`}
          onClick={() => (isThis ? engine.toggle() : engine.playQueue(album.trackIds, 0, label))}
          className={cn(
            'lc-focus lc-glass-float absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-[opacity,transform] duration-200',
            playing
              ? 'opacity-100'
              : 'translate-y-1 opacity-0 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100',
          )}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
      </div>
      <Link to={`/albums/${album.id}`} tabIndex={-1} className="mt-2.5 block">
        <div className="truncate text-[13px] font-medium text-foreground">{album.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {album.artist}
          {album.year ? ` · ${album.year}` : ''}
        </div>
      </Link>
    </div>
  )
}
