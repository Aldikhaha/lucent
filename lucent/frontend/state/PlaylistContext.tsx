import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { deletePlaylistCover, savePlaylistCover } from '../core/playlistCovers'

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  coverRevision: number
}

const KEY = 'lucent.playlists.v1'
const cleanIds = (ids: unknown): string[] =>
  Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))] : []

function readPlaylists(): Playlist[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    return raw.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return []
      const p = item as Partial<Playlist>
      if (typeof p.id !== 'string' || !p.id || seen.has(p.id) || typeof p.name !== 'string' || !p.name.trim()) return []
      seen.add(p.id)
      return [
        {
          id: p.id,
          name: p.name.trim().slice(0, 100),
          trackIds: cleanIds(p.trackIds),
          createdAt: Number.isFinite(p.createdAt) ? p.createdAt! : 0,
          coverRevision: Number.isFinite(p.coverRevision) ? p.coverRevision! : 0,
        },
      ]
    })
  } catch {
    return []
  }
}

interface PlaylistContextValue {
  playlists: Playlist[]
  create: (name: string, initialTrackId?: string) => string | null
  rename: (id: string, name: string) => boolean
  remove: (id: string) => void
  addTrack: (id: string, trackId: string) => boolean
  removeTrack: (id: string, trackId: string) => void
  moveTrack: (id: string, trackId: string, direction: -1 | 1) => void
  removeFromAll: (ids: Set<string>) => void
  setCover: (id: string, file: File | null) => Promise<void>
}

const Context = createContext<PlaylistContextValue | null>(null)

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>(readPlaylists)
  const current = useRef(playlists)
  const update = useCallback((fn: (old: Playlist[]) => Playlist[]) => {
    const next = fn(current.current)
    if (next === current.current) return
    current.current = next
    setPlaylists(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      toast.error('Could not save playlists', {
        description: 'Your changes may be lost when Lucent closes. Check available storage.',
      })
    }
  }, [])

  const create = useCallback(
    (name: string, initialTrackId?: string) => {
      const trimmed = name.trim().slice(0, 100)
      if (!trimmed || current.current.some((p) => p.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()))
        return null
      const id = crypto.randomUUID()
      update((old) => [
        ...old,
        { id, name: trimmed, trackIds: initialTrackId ? [initialTrackId] : [], createdAt: Date.now(), coverRevision: 0 },
      ])
      return id
    },
    [update],
  )
  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim().slice(0, 100)
      if (
        !trimmed ||
        current.current.some((p) => p.id !== id && p.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
      )
        return false
      update((old) => old.map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
      return true
    },
    [update],
  )
  const remove = useCallback((id: string) => { update((old) => old.filter((p) => p.id !== id)); void deletePlaylistCover(id).catch(() => undefined) }, [update])
  const setCover = useCallback(async (id: string, file: File | null) => {
    if (!current.current.some((p) => p.id === id)) throw new Error('Playlist not found.')
    if (file) await savePlaylistCover(id, file)
    else await deletePlaylistCover(id)
    update((old) => old.map((p) => p.id === id ? { ...p, coverRevision: file ? Date.now() : 0 } : p))
  }, [update])
  const addTrack = useCallback(
    (id: string, trackId: string) => {
      const playlist = current.current.find((p) => p.id === id)
      if (!playlist || !trackId || playlist.trackIds.includes(trackId)) return false
      update((old) => old.map((p) => (p.id === id ? { ...p, trackIds: [...p.trackIds, trackId] } : p)))
      return true
    },
    [update],
  )
  const removeTrack = useCallback(
    (id: string, trackId: string) =>
      update((old) => old.map((p) => (p.id === id ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p))),
    [update],
  )
  const moveTrack = useCallback(
    (id: string, trackId: string, direction: -1 | 1) =>
      update((old) =>
        old.map((p) => {
          if (p.id !== id) return p
          const index = p.trackIds.indexOf(trackId)
          const target = index + direction
          if (index < 0 || target < 0 || target >= p.trackIds.length) return p
          const trackIds = p.trackIds.slice()
          ;[trackIds[index], trackIds[target]] = [trackIds[target]!, trackIds[index]!]
          return { ...p, trackIds }
        }),
      ),
    [update],
  )
  const removeFromAll = useCallback(
    (ids: Set<string>) =>
      update((old) =>
        old.map((p) => ({
          ...p,
          trackIds: p.trackIds.filter((id) => !ids.has(id)),
        })),
      ),
    [update],
  )
  const value = useMemo(
    () => ({ playlists, create, rename, remove, addTrack, removeTrack, moveTrack, removeFromAll, setCover }),
    [playlists, create, rename, remove, addTrack, removeTrack, moveTrack, removeFromAll, setCover],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function usePlaylists(): PlaylistContextValue {
  const value = useContext(Context)
  if (!value) throw new Error('usePlaylists must be used within PlaylistProvider')
  return value
}
