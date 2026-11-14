import { Maximize2 } from 'lucide-react'
import { useCurrentTrack, usePlayerState } from '../../state/PlayerContext'
import { useUi } from '../../state/UiContext'
import { Artwork } from './Artwork'
import { PlaybackControls } from './PlaybackControls'
import { SeekBar } from './SeekBar'
import { VolumeControl } from './VolumeControl'
import { IconButton } from './IconButton'

/** Floating glass playback bar. */
export function MiniPlayer() {
  const track = useCurrentTrack()
  const { contextLabel } = usePlayerState()
  const { setNowPlayingOpen, queueOpen, setQueueOpen } = useUi()

  return (
    <footer className="lc-glass-float relative z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-[18px] px-3 py-2.5 [.lc-compact_&]:py-1.5">
      <button
        type="button"
        disabled={!track}
        onClick={() => setNowPlayingOpen(true)}
        className="lc-focus group flex min-w-0 items-center gap-3 rounded-xl p-1 pr-3 text-left transition-colors enabled:hover:bg-[hsl(var(--lc-hover)/0.05)]"
        aria-label={track ? `Open Now Playing: ${track.title}` : 'Nothing playing'}
      >
        <Artwork
          artworkId={track?.artworkId ?? null}
          eager
          className="h-12 w-12 rounded-lg shadow-[0_4px_12px_-4px_hsl(var(--lc-shadow)/0.5)] [.lc-compact_&]:h-10 [.lc-compact_&]:w-10"
        />
        <div className="min-w-0">
          {track ? (
            <>
              <div className="truncate text-[13px] font-medium text-foreground">{track.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {track.artist}
                {contextLabel && <span className="hidden xl:inline"> · {contextLabel}</span>}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-medium text-muted-foreground">Nothing playing</div>
              <div className="text-xs text-muted-foreground/70">Choose a song to begin</div>
            </>
          )}
        </div>
      </button>

      <div className="flex w-[min(540px,46vw)] flex-col items-center gap-0.5">
        <PlaybackControls queueActive={queueOpen} onToggleQueue={() => setQueueOpen(!queueOpen)} />
        <SeekBar />
      </div>

      <div className="flex items-center justify-end gap-1">
        <VolumeControl className="hidden md:flex" />
        <IconButton label="Now Playing" shortcut="N" size="sm" disabled={!track} onClick={() => setNowPlayingOpen(true)}>
          <Maximize2 />
        </IconButton>
      </div>
    </footer>
  )
}
