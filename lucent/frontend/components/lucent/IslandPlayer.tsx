import { Maximize2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useCurrentTrack, usePlayer, usePlayerState } from '../../state/PlayerContext'
import { isDesktop } from '../../core/platform'
import { Artwork } from './Artwork'
import { SeekBar } from './SeekBar'

export function IslandPlayer({ onExpand }: { onExpand: () => void }) {
  const player = usePlayer()
  const track = useCurrentTrack()
  const { status, queue } = usePlayerState()
  const playing = status === 'playing' || status === 'loading'
  const control = 'lc-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-[hsl(var(--lc-hover)/0.1)] disabled:opacity-30'
  return <main className="h-screen p-2 text-foreground">
    <div className="lc-glass-float flex h-full flex-col justify-center rounded-[28px] px-4 shadow-xl">
      <div data-tauri-drag-region={isDesktop ? '' : undefined} className="flex min-w-0 items-center gap-3">
        <Artwork artworkId={track?.artworkId ?? null} eager className="h-12 w-12 rounded-xl" />
        <div data-tauri-drag-region={isDesktop ? '' : undefined} className="min-w-0 flex-1 select-none">
          <div className="truncate text-sm font-semibold">{track?.title ?? 'Nothing playing'}</div>
          <div className="truncate text-xs text-muted-foreground">{track?.artist ?? 'Choose a song to begin'}</div>
        </div>
        <button type="button" aria-label="Previous" className={control} disabled={!queue.length} onClick={() => player.previous()}><SkipBack size={16} fill="currentColor" /></button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className={`${control} bg-foreground text-background`} disabled={!queue.length} onClick={() => player.toggle()}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
        <button type="button" aria-label="Next" className={control} disabled={!queue.length} onClick={() => player.next()}><SkipForward size={16} fill="currentColor" /></button>
        <button type="button" aria-label="Restore full player" title="Restore full player" className={control} onClick={onExpand}><Maximize2 size={16} /></button>
      </div>
      <SeekBar className="mt-2" />
    </div>
  </main>
}
