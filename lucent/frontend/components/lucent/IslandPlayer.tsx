import { useEffect, useState, type PointerEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronDown, ChevronUp, GripHorizontal, ListMusic, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { useCurrentTrack, usePlayer, usePlayerState } from '../../state/PlayerContext'
import { useLibrary } from '../../state/LibraryContext'
import { isDesktop } from '../../core/platform'
import { Artwork } from './Artwork'
import { SeekBar } from './SeekBar'

type IslandView = 'compact' | 'expanded' | 'queue'
export function IslandPlayer({ onExpand, onResize }: { onExpand: () => void; onResize: (view: IslandView) => void }) {
  const player = usePlayer(); const track = useCurrentTrack(); const state = usePlayerState(); const { byId } = useLibrary()
  const playing = state.status === 'playing' || state.status === 'loading'
  const [view, setView] = useState<IslandView>('compact')
  const [inside, setInside] = useState(false)
  const change = (next: IslandView) => { setView(next); onResize(next) }
  useEffect(() => { if (view !== 'expanded' || inside) return; const id = setTimeout(() => { setView('compact'); onResize('compact') }, 5000); return () => clearTimeout(id) }, [view, inside, onResize])
  function drag(e: PointerEvent<HTMLElement>) {
    if (!isDesktop || e.button !== 0 || (e.target as HTMLElement).closest('button, input, [role="slider"], a')) return
    e.preventDefault(); void getCurrentWindow().startDragging().catch(() => undefined)
  }
  const control = 'lc-island-button lc-focus'
  return <main className="lc-island-window h-screen p-2" onPointerDown={drag} onMouseEnter={() => setInside(true)} onMouseLeave={() => setInside(false)}>
    <div className="lc-island h-full overflow-hidden" data-island-view={view}>
      <div className="flex h-[72px] items-center gap-3 px-3">
        <div key={track?.id ?? 'empty'} className="lc-island-track flex min-w-0 flex-1 items-center gap-3">
          <Artwork artworkId={track?.artworkId ?? null} eager className="h-12 w-12 rounded-[14px]" />
          <div className="min-w-0 flex-1 select-none" title="Drag to move"><div className="truncate text-sm font-semibold text-white">{track?.title ?? 'Nothing playing'}</div><div className="truncate text-xs text-slate-300">{track?.artist ?? 'Choose a song to begin'}</div></div>
        </div>
        <div className="lc-island-bars" aria-label={playing ? 'Playing' : 'Paused'} data-playing={playing}><i/><i/><i/><i/><i/><i/><i/></div>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className={control} disabled={!state.queue.length} onClick={() => player.toggle()}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
        <button type="button" aria-label="Next" className={control} disabled={!state.queue.length} onClick={() => player.next()}><SkipForward size={17} fill="currentColor" /></button>
        <button type="button" aria-label={view === 'compact' ? 'Expand island controls' : 'Collapse island controls'} className={control} onClick={() => change(view === 'compact' ? 'expanded' : 'compact')}>{view === 'compact' ? <ChevronDown size={17}/> : <ChevronUp size={17}/>}</button>
      </div>
      {view !== 'compact' && <div className="px-4 pb-3 text-white"><SeekBar className="lc-island-seek"/><div className="mt-1 flex items-center justify-center gap-3">
        <button type="button" aria-label={state.shuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed={state.shuffle} className={control} onClick={() => player.toggleShuffle()}><Shuffle size={16}/></button>
        <button type="button" aria-label="Previous" className={control} disabled={!state.queue.length} onClick={() => player.previous()}><SkipBack size={17} fill="currentColor"/></button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className={`${control} lc-island-main-control`} disabled={!state.queue.length} onClick={() => player.toggle()}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button>
        <button type="button" aria-label="Next" className={control} disabled={!state.queue.length} onClick={() => player.next()}><SkipForward size={17} fill="currentColor"/></button>
        <button type="button" aria-label={`Loop ${state.repeat}`} className={control} onClick={() => player.cycleRepeat()}>{state.repeat === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}</button>
        <button type="button" aria-label={view === 'queue' ? 'Hide queue preview' : 'Show queue preview'} aria-pressed={view === 'queue'} className={control} onClick={() => change(view === 'queue' ? 'expanded' : 'queue')}><ListMusic size={16}/></button>
        <button type="button" aria-label="Restore full player" className={control} onClick={onExpand}><Maximize2 size={16}/></button>
      </div><div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-400"><GripHorizontal size={13}/> Drag the artwork or empty space to move</div>
      {view === 'queue' && <div className="mt-2 border-t border-white/10 pt-2"><p className="mb-1 text-[11px] uppercase tracking-widest text-slate-400">Up next</p>{state.queue.slice(state.index + 1, state.index + 4).map((id, i) => { const song = byId.get(id); return song ? <button key={id} className="lc-island-queue-row lc-focus" onClick={() => player.jumpTo(state.index + i + 1)}><Artwork artworkId={song.artworkId} className="h-8 w-8 rounded-lg"/><span className="min-w-0 flex-1 truncate text-left text-xs">{song.title} <span className="text-slate-400">· {song.artist}</span></span><Play size={14}/></button> : null })}{state.index >= state.queue.length - 1 && <p className="text-xs text-slate-400">No upcoming songs</p>}</div>}
      </div>}
    </div>
  </main>
}
