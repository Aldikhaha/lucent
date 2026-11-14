import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { getArtworkUrl } from '../../core/artwork'
import { useCurrentTrack, usePlayerState } from '../../state/PlayerContext'
import { useUi } from '../../state/UiContext'
import { usePrefs } from '../../state/PrefsContext'
import { TrackTransition } from './TrackTransition'
import { IconButton } from './IconButton'
import { PlaybackControls } from './PlaybackControls'
import { QueueList } from './QueueList'
import { SeekBar } from './SeekBar'
import { VolumeControl } from './VolumeControl'
import { cn } from '../../lib/shadcn/utils'

type Panel = 'queue' | 'lyrics'

/** Immersive full-window Now Playing view. */
export function NowPlaying() {
  const { nowPlayingOpen, setNowPlayingOpen } = useUi()
  const { prefs, reducedMotion } = usePrefs()
  const track = useCurrentTrack()
  const { status, contextLabel } = usePlayerState()
  const [panelOpen, setPanelOpen] = useState(true)
  const [panel, setPanel] = useState<Panel>('queue')
  const [background, setBackground] = useState<{ id: string; url: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!track?.artworkId) {
      setBackground(null)
      return
    }
    const id = track.artworkId
    void getArtworkUrl(id).then((url) => !cancelled && setBackground({ id, url }))
    return () => {
      cancelled = true
    }
  }, [track?.artworkId])

  useEffect(() => {
    if (!track?.lyrics && panel === 'lyrics') setPanel('queue')
  }, [track?.lyrics, panel])

  useEffect(() => {
    if (nowPlayingOpen && !track) setNowPlayingOpen(false)
  }, [nowPlayingOpen, track, setNowPlayingOpen])

  if (!nowPlayingOpen || !track) return null
  const playing = status === 'playing' || status === 'loading'
  const bgUrl = track.artworkId && background?.id === track.artworkId ? background.url : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      className="fixed inset-x-0 bottom-0 top-[var(--lc-titlebar-h,0px)] z-40 flex flex-col overflow-hidden bg-background duration-300 animate-in fade-in-0 slide-in-from-bottom-3"
    >
      {/* Ambient artwork background */}
      <div className="pointer-events-none absolute inset-0">
        {bgUrl && (
          <div
            className="absolute inset-[-15%] bg-cover bg-center opacity-50 blur-[100px] saturate-150 dark:opacity-40"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.55)_75%)]" />
      </div>

      {prefs.nowPlayingEffects && !reducedMotion && (
        <div className="lc-effects pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-playing={playing} data-quality={prefs.effectQuality} data-effect={prefs.effectType}>
          {prefs.effectType === 'aurora' ? <><i className="lc-aurora lc-aurora-one" /><i className="lc-aurora lc-aurora-two" /></> :
            Array.from({ length: prefs.effectQuality === 'full' ? 72 : 24 }, (_, i) => (
              <span key={i} className="lc-effect-particle" style={{
                left: `${(i * 37.73) % 100}%`, top: `${(i * 61.3) % 100}%`,
                animationDelay: `${-(i * 0.47)}s`, animationDuration: `${prefs.effectType === 'rain' ? 1.1 + (i % 4) * 0.18 : 5 + (i % 7) * 0.8}s`,
                '--size': `${2 + i % (prefs.effectQuality === 'full' ? 5 : 3)}px`,
              } as CSSProperties} />
            ))}
        </div>
      )}

      <header className="relative z-10 flex items-center justify-between px-6 pt-5">
        <IconButton label="Close Now Playing" shortcut="Esc" tooltipSide="right" onClick={() => setNowPlayingOpen(false)}>
          <ChevronDown />
        </IconButton>
        <div className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Now Playing</div>
          {contextLabel && <div className="max-w-[40vw] truncate text-xs text-foreground/80">{contextLabel}</div>}
        </div>
        <div className="w-9" />
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-8 px-8 pb-8 pt-4 lg:px-14">
        <section className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <div className="flex w-full max-w-[460px] flex-col">
            <TrackTransition track={track} playing={playing} reducedMotion={reducedMotion} />
            <SeekBar className="mt-6" showTimes timeClassName="text-xs" />
            <PlaybackControls
              size="large"
              className="mt-4"
              queueActive={panelOpen}
              onToggleQueue={() => setPanelOpen(!panelOpen)}
            />
            <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
              <VolumeControl />
              <span className="lc-hairline rounded-full border px-2 py-0.5 tracking-wide">{track.format}</span>
            </div>
          </div>
        </section>

        {panelOpen && (
          <aside className="lc-glass hidden w-[360px] shrink-0 flex-col rounded-[18px] duration-300 animate-in fade-in-0 slide-in-from-right-4 lg:flex">
            <div className="flex gap-1 p-2" role="tablist" aria-label="Side panel">
              {(['queue', 'lyrics'] as const).map((p) => {
                const disabled = p === 'lyrics' && !track.lyrics
                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={panel === p}
                    disabled={disabled}
                    title={disabled ? 'No embedded lyrics in this file' : undefined}
                    onClick={() => setPanel(p)}
                    className={cn(
                      'lc-focus flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40',
                      panel === p ? 'lc-active text-foreground' : 'text-muted-foreground enabled:hover:text-foreground',
                    )}
                  >
                    {p === 'queue' ? 'Queue' : 'Lyrics'}
                  </button>
                )
              })}
            </div>
            <div className="lc-scroll flex-1 overflow-y-auto px-3 pb-4 pt-1">
              {panel === 'queue' ? (
                <QueueList />
              ) : (
                <p className="whitespace-pre-line px-3 py-2 text-[15px] leading-7 text-foreground/90">{track.lyrics}</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
