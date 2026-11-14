import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PlayerEngine, type PlayerState } from '../core/player'
import { getAudio } from '../core/db'
import { getArtworkUrl } from '../core/artwork'
import { isDesktop } from '../core/platform'
import { playableUrl } from '../core/platform/desktop'
import type { Track } from '../core/types'
import { useLibrary } from './LibraryContext'

const PlayerContext = createContext<PlayerEngine | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const library = useLibrary()
  const libRef = useRef(library)
  libRef.current = library

  const [engine] = useState(
    () =>
      new PlayerEngine({
        loadSource: async (id) => {
          const t = libRef.current.byId.get(id)
          if (isDesktop && t?.path) return { url: await playableUrl(t.path, t.title) }
          const blob = await getAudio(id).catch(() => undefined)
          if (!blob) return null
          const url = URL.createObjectURL(blob)
          return { url, release: () => URL.revokeObjectURL(url) }
        },
        describe: (id) => {
          const t = libRef.current.byId.get(id)
          return t ? { title: t.title, artist: t.artist, album: t.album, artworkId: t.artworkId } : null
        },
        artworkUrl: (artworkId) => getArtworkUrl(artworkId),
        onStarted: (id) => libRef.current.markPlayed(id),
        onError: (message) => toast.error('Playback error', { description: message }),
      }),
  )

  // Restore the last session once the library has loaded.
  const restored = useRef(false)
  useEffect(() => {
    if (!library.ready || restored.current) return
    restored.current = true
    engine.restore(new Set(library.tracks.map((t) => t.id)))
  }, [library.ready, library.tracks, engine])

  return <PlayerContext.Provider value={engine}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerEngine {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}

export function usePlayerState(): PlayerState {
  const engine = usePlayer()
  return useSyncExternalStore(engine.subscribe, engine.getState)
}

/** Current playback position in seconds (updates ~4×/s while playing). */
export function usePlaybackTime(): number {
  const engine = usePlayer()
  return useSyncExternalStore(engine.subscribeTime, engine.getTime)
}

export function useCurrentTrack(): Track | null {
  const state = usePlayerState()
  const { byId } = useLibrary()
  const id = state.queue[state.index]
  return id ? (byId.get(id) ?? null) : null
}

/** Library + playback actions that need both contexts. */
export function useTrackActions() {
  const engine = usePlayer()
  const library = useLibrary()

  const removeTracks = useCallback(
    async (ids: string[]) => {
      try {
        engine.removeTracks(new Set(ids))
        await library.removeTracks(ids)
        toast(`Removed ${ids.length === 1 ? 'song' : `${ids.length} songs`} from library`)
      } catch {
        toast.error('Could not remove from library')
      }
    },
    [engine, library],
  )

  const clearLibrary = useCallback(async () => {
    engine.reset()
    await library.clearLibrary()
    toast('Library cleared')
  }, [engine, library])

  const playNext = useCallback(
    (ids: string[]) => {
      engine.playNext(ids)
      toast(ids.length === 1 ? 'Playing next' : `${ids.length} songs playing next`)
    },
    [engine],
  )

  const addToQueue = useCallback(
    (ids: string[]) => {
      engine.addToQueue(ids)
      toast(ids.length === 1 ? 'Added to queue' : `${ids.length} songs added to queue`)
    },
    [engine],
  )

  return { removeTracks, clearLibrary, playNext, addToQueue }
}
