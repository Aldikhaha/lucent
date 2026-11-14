import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Track } from '../../core/types'
import { albumKey } from '../../state/LibraryContext'
import { useUi } from '../../state/UiContext'
import { Artwork } from './Artwork'
import { cn } from '../../lib/shadcn/utils'

const DURATION_MS = 380
interface TransitionState { current: Track; previous: Track | null; generation: number }

function SongCard({ track, playing }: { track: Track; playing: boolean }) {
  const navigate = useNavigate()
  const { setNowPlayingOpen } = useUi()
  return <div className="flex min-w-0 flex-col">
    <Artwork
      key={track.artworkId ?? 'no-art'}
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
        {track.artist}<span className="mx-1.5 opacity-50">·</span>
        <button type="button" className="lc-focus rounded hover:text-foreground hover:underline" onClick={() => {
          setNowPlayingOpen(false)
          navigate(`/albums/${albumKey(track)}`)
        }}>{track.album}</button>
      </p>
    </div>
  </div>
}

/** At most one outgoing card; both cards occupy the same grid cell, never stacking in layout. */
export function TrackTransition({ track, playing, reducedMotion }: { track: Track; playing: boolean; reducedMotion: boolean }) {
  const [state, setState] = useState<TransitionState>(() => ({ current: track, previous: null, generation: 0 }))
  useLayoutEffect(() => {
    setState((old) => {
      if (old.current.id === track.id) {
        if (old.current === track && !(reducedMotion && old.previous)) return old
        return { ...old, current: track, previous: reducedMotion ? null : old.previous }
      }
      return { current: track, previous: reducedMotion ? null : old.current, generation: old.generation + 1 }
    })
  }, [track, reducedMotion])

  // Never depend solely on animationend: animations can be cancelled or suppressed.
  useEffect(() => {
    if (!state.previous) return
    const generation = state.generation
    const timer = window.setTimeout(() => setState((old) => old.generation === generation ? { ...old, previous: null } : old), DURATION_MS + 80)
    return () => window.clearTimeout(timer)
  }, [state.generation, state.previous])

  return <div className="lc-track-stage" data-track-stage>
    {state.previous && <div key={`out-${state.generation}`} className="lc-track-layer lc-track-out" data-track-role="outgoing" aria-hidden="true" inert onAnimationEnd={(event) => {
      if (event.target !== event.currentTarget || event.animationName !== 'lc-track-exit') return
      const generation = state.generation
      setState((old) => old.generation === generation ? { ...old, previous: null } : old)
    }}><SongCard track={state.previous} playing={playing} /></div>}
    <div key={`in-${state.generation}`} className={cn('lc-track-layer', state.previous && 'lc-track-in')} data-track-role="current" data-track-id={state.current.id}>
      <SongCard track={state.current} playing={playing} />
    </div>
  </div>
}
