import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square } from 'lucide-react'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { IconButton } from './IconButton'
import { cn } from '../../lib/shadcn/utils'

interface PlaybackControlsProps {
  size?: 'mini' | 'large'
  queueActive: boolean
  onToggleQueue: () => void
  className?: string
}

const REPEAT_LABEL = { off: 'Loop off', all: 'Loop queue', one: 'Loop this song' } as const

/** Stop · Shuffle · Previous · Play/Pause · Next · Loop · Queue */
export function PlaybackControls({ size = 'mini', queueActive, onToggleQueue, className }: PlaybackControlsProps) {
  const engine = usePlayer()
  const { status, shuffle, repeat, queue, index } = usePlayerState()
  const hasTrack = index >= 0
  const isPlaying = status === 'playing' || status === 'loading'
  const btn = size === 'large' ? 'lg' : 'sm'
  const skip = size === 'large' ? 'lg' : 'md'

  return (
    <div className={cn('flex items-center justify-center', size === 'large' ? 'gap-3' : 'gap-1.5', className)}>
      <IconButton
        label="Stop"
        shortcut="."
        size={btn}
        disabled={!hasTrack || status === 'stopped'}
        onClick={() => engine.stop()}
      >
        <Square className="fill-current" />
      </IconButton>
      <IconButton
        label={shuffle ? 'Shuffle on' : 'Shuffle off'}
        shortcut="S"
        size={btn}
        active={shuffle}
        aria-pressed={shuffle}
        onClick={() => engine.toggleShuffle()}
      >
        <Shuffle />
      </IconButton>
      <IconButton label="Previous" shortcut="Ctrl ←" size={skip} disabled={!queue.length} onClick={() => engine.previous()}>
        <SkipBack className="fill-current" />
      </IconButton>
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={!queue.length}
        onClick={() => engine.toggle()}
        className={cn(
          'lc-focus inline-flex shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[0_6px_16px_-6px_hsl(var(--lc-shadow)/0.6)] transition-transform duration-150 hover:scale-[1.04] active:scale-95 disabled:opacity-40 disabled:hover:scale-100',
          size === 'large' ? 'h-16 w-16 [&_svg]:h-7 [&_svg]:w-7' : 'mx-1 h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]',
        )}
      >
        {isPlaying ? <Pause className="fill-current" /> : <Play className="ml-0.5 fill-current" />}
      </button>
      <IconButton label="Next" shortcut="Ctrl →" size={skip} disabled={!queue.length} onClick={() => engine.next()}>
        <SkipForward className="fill-current" />
      </IconButton>
      <IconButton
        label={REPEAT_LABEL[repeat]}
        shortcut="R"
        size={btn}
        active={repeat !== 'off'}
        onClick={() => engine.cycleRepeat()}
      >
        {repeat === 'one' ? <Repeat1 /> : <Repeat />}
      </IconButton>
      <IconButton
        label={queueActive ? 'Hide queue' : 'Show queue'}
        shortcut="Q"
        size={btn}
        active={queueActive}
        aria-pressed={queueActive}
        onClick={onToggleQueue}
      >
        <ListMusic />
      </IconButton>
    </div>
  )
}
