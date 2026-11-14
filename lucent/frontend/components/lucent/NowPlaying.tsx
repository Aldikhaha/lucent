import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getArtworkUrl } from '../../core/artwork'
import { albumKey } from '../../state/LibraryContext'
import { useCurrentTrack, usePlayerState } from '../../state/PlayerContext'
import { useUi } from '../../state/UiContext'
import { usePrefs } from '../../state/PrefsContext'
import { Artwork } from './Artwork'
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
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(true)
  const [panel, setPanel] = useState<Panel>('queue')
  const [bgUrl, setBgUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!track?.artworkId) {
      setBgUrl(null)
      return
    }
    void getArtworkUrl(track.artworkId).then((u) => !cancelled && setBgUrl(u))
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
        <div className="lc-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-playing={playing}>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="lc-particle" style={{
              left: `${8 + ((i * 37) % 85)}%`, top: `${12 + ((i * 53) % 76)}%`,
              animationDelay: `${-(i * 0.83)}s`, animationDuration: `${7 + (i % 5) * 1.4}s`,
              width: i % 4 === 0 ? 4 : 2, height: i % 4 === 0 ? 4 : 2,
            }} />
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
            <Artwork
              artworkId={track.artworkId}
              eager
              className={cn(
                'aspect-square w-full max-w-[min(460px,48vh)] self-center rounded-[20px] shadow-[0_40px_80px_-30px_hsl(var(--lc-shadow)/0.7),0_8px_24px_-8px_hsl(var(--lc-shadow)/0.4)] transition-transform duration-700 [transition-timing-function:var(--ease-glass)]',
                playing ? 'scale-100' : 'scale-[0.94]',
              )}
            />
            <div className="mt-8 min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{track.title}</h1>
              <p className="mt-1 truncate text-[15px] text-muted-foreground">
                {track.artist}
                <span className="mx-1.5 opacity-50">·</span>
                <button
                  type="button"
                  className="lc-focus rounded hover:text-foreground hover:underline"
                  onClick={() => {
                    setNowPlayingOpen(false)
                    navigate(`/albums/${albumKey(track)}`)
                  }}
                >
                  {track.album}
                </button>
              </p>
            </div>
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
                    {p === 'queue' ? 'Up Next' : 'Lyrics'}
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
