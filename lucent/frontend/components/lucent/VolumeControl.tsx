import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { Slider } from '../../lib/shadcn/slider'
import { IconButton } from './IconButton'
import { cn } from '../../lib/shadcn/utils'

export function VolumeControl({ className }: { className?: string }) {
  const engine = usePlayer()
  const { volume, muted } = usePlayerState()
  const effective = muted ? 0 : volume
  const Icon = effective === 0 ? VolumeX : effective < 0.34 ? Volume : effective < 0.67 ? Volume1 : Volume2

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <IconButton label={muted ? 'Unmute' : 'Mute'} shortcut="M" size="sm" onClick={() => engine.toggleMute()}>
        <Icon />
      </IconButton>
      <Slider
        aria-label="Volume"
        className="lc-slider w-24 cursor-pointer"
        min={0}
        max={100}
        step={1}
        value={[Math.round(effective * 100)]}
        onValueChange={(v) => engine.setVolume((v[0] ?? 0) / 100)}
      />
    </div>
  )
}
