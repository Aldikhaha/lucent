import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Album, Folder, Track } from '../core/types'
import * as db from '../core/db'
import { revokeAllArtwork, revokeArtwork } from '../core/artwork'
import {
  AUDIO_ACCEPT,
  fingerprintOf,
  importItems,
  itemsFromDataTransfer,
  itemsFromFiles,
  itemsFromScanned,
  type ImportItem,
  type ImportProgress,
} from '../core/importer'
import { hashString, plural } from '../core/format'
import { isDesktop } from '../core/platform'
import { pickAudioFiles, pickMusicFolders, registerLibraryFiles, scanPaths, type ScannedFile } from '../core/platform/desktop'

interface LibraryContextValue {
  ready: boolean
  tracks: Track[]
  byId: Map<string, Track>
  albums: Album[]
  albumsById: Map<string, Album>
  folders: Folder[]
  foldersById: Map<string, Folder>
  progress: ImportProgress | null
  /** Desktop: tracks whose file is no longer on disk */
  missingIds: Set<string>
  pickFiles: () => void
  pickFolder: () => void
  importDropped: (dt: DataTransfer) => Promise<void>
  /** Desktop: imports files/folders by path; resolves to the library ids of the audio files found. */
  importPaths: (paths: string[]) => Promise<string[]>
  checkMissing: () => Promise<void>
  removeTracks: (ids: string[]) => Promise<void>
  clearLibrary: () => Promise<void>
  markPlayed: (id: string) => void
  clearHistory: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export const albumKey = (t: Track) => hashString(`${(t.albumArtist || t.artist).toLowerCase()}\u0001${t.album.toLowerCase()}`)
export const folderKey = (path: string) => hashString(path || '~')

const byTrackOrder = (a: Track, b: Track) =>
  (a.trackNo ?? 9999) - (b.trackNo ?? 9999) || a.title.localeCompare(b.title)

function groupAlbums(tracks: Track[]): Album[] {
  const map = new Map<string, Album & { _tracks: Track[] }>()
  for (const t of tracks) {
    const id = albumKey(t)
    let a = map.get(id)
    if (!a) {
      a = {
        id,
        title: t.album,
        artist: t.albumArtist || t.artist,
        year: t.year,
        artworkId: t.artworkId,
        accent: t.accent,
        trackIds: [],
        duration: 0,
        addedAt: 0,
        _tracks: [],
      }
      map.set(id, a)
    }
    a._tracks.push(t)
    a.duration += t.duration
    a.addedAt = Math.max(a.addedAt, t.addedAt)
    if (!a.artworkId && t.artworkId) {
      a.artworkId = t.artworkId
      a.accent = t.accent
    }
    a.year ??= t.year
  }
  return Array.from(map.values())
    .map(({ _tracks, ...album }) => ({ ...album, trackIds: _tracks.sort(byTrackOrder).map((t) => t.id) }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

function groupFolders(tracks: Track[]): Folder[] {
  const map = new Map<string, Folder & { _tracks: Track[] }>()
  for (const t of tracks) {
    const id = folderKey(t.folder)
    let f = map.get(id)
    if (!f) {
      f = { id, path: t.folder, name: t.folder.split('/').pop() || 'Loose files', trackIds: [], duration: 0, _tracks: [] }
      map.set(id, f)
    }
    f._tracks.push(t)
    f.duration += t.duration
  }
  return Array.from(map.values())
    .map(({ _tracks, ...folder }) => ({
      ...folder,
      trackIds: _tracks.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true })).map((t) => t.id),
    }))
    .sort((a, b) => (a.path || '\uffff').localeCompare(b.path || '\uffff'))
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : typeof err === 'string' ? err : undefined)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [missingIds, setMissingIds] = useState<Set<string>>(() => new Set())
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const missingRef = useRef(missingIds)
  missingRef.current = missingIds
  const importingRef = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  /** Desktop: lets the webview stream library files and finds the ones that went missing. */
  const refreshMissing = useCallback(async (list: Track[]) => {
    if (!isDesktop) return new Set<string>()
    const withPath = list.filter((t) => t.path)
    const missingPaths = new Set(await registerLibraryFiles(withPath.map((t) => t.path!)))
    const missing = new Set(withPath.filter((t) => missingPaths.has(t.path!)).map((t) => t.id))
    setMissingIds(missing)
    return missing
  }, [])

  useEffect(() => {
    db.getAllTracks()
      .then((all) => {
        setTracks(all.sort((a, b) => a.addedAt - b.addedAt))
        if (isDesktop) {
          void refreshMissing(all)
            .then((missing) => {
              if (missing.size)
                toast(`${plural(missing.size, 'song')} can't be found`, {
                  description: 'They were moved, renamed or deleted. Re-import the folder to relink them, or remove them in Settings.',
                })
            })
            .catch((err) => console.warn('[lucent] missing-file check failed', err))
        }
      })
      .catch((err) => {
        console.error('[lucent] failed to open library', err)
        toast.error('Could not open your local library', {
          description: isDesktop ? 'The library database could not be opened.' : 'Storage may be disabled in this browser.',
        })
      })
      .finally(() => setReady(true))
  }, [refreshMissing])

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  /** Imports items and resolves to the tracks that were added. */
  const runImport = useCallback(async (items: ImportItem[]): Promise<Track[]> => {
    if (!items.length) {
      toast('No audio files found', { description: 'Lucent reads MP3, M4A, AAC, FLAC, WAV, OGG and Opus.' })
      return []
    }
    if (importingRef.current) {
      toast('An import is already running', { description: 'Try again when it finishes.' })
      return []
    }
    importingRef.current = true
    if (!isDesktop) void navigator.storage?.persist?.().catch(() => false)

    const ctx = {
      fingerprints: new Set(tracksRef.current.map((t) => t.fingerprint)),
      artwork: new Map(tracksRef.current.filter((t) => t.artworkId).map((t) => [t.artworkId!, t.accent] as const)),
    }
    const added: Track[] = []
    let pending: Track[] = []
    const flush = () => {
      if (!pending.length) return
      const batch = pending
      pending = []
      setTracks((prev) => [...prev, ...batch])
    }
    const timer = setInterval(flush, 400)
    try {
      const result = await importItems(items, ctx, setProgress, (t) => {
        added.push(t)
        pending.push(t)
      })
      flush()
      const parts = [`${plural(result.added, 'song')} added`]
      if (result.skipped) parts.push(`${result.skipped} already in library`)
      if (result.failed) parts.push(`${result.failed} unsupported`)
      if (result.added) toast.success('Import complete', { description: parts.join(' · ') })
      else toast('Nothing new imported', { description: parts.join(' · ') })
    } catch (err) {
      console.error('[lucent] import failed', err)
      toast.error('Import failed', { description: errorText(err) ?? 'Storage may be full.' })
    } finally {
      clearInterval(timer)
      flush()
      importingRef.current = false
      setProgress(null)
    }
    return added
  }, [])

  const importPaths = useCallback(
    async (paths: string[]): Promise<string[]> => {
      if (!isDesktop || !paths.length) return []
      let scanned: ScannedFile[]
      try {
        scanned = await scanPaths(paths)
      } catch (err) {
        toast.error('Could not read those files', { description: errorText(err) })
        return []
      }

      // Relink songs whose file was moved: same name/size/date, old path gone.
      const byFingerprint = new Map(tracksRef.current.map((t) => [t.fingerprint, t]))
      const relinked: Track[] = []
      for (const f of scanned) {
        const t = byFingerprint.get(fingerprintOf(f))
        if (t?.path && t.path !== f.path && missingRef.current.has(t.id)) relinked.push({ ...t, path: f.path, folder: f.folder })
      }
      if (relinked.length) {
        const map = new Map(relinked.map((t) => [t.id, t]))
        await db.updateTracks(relinked)
        setTracks((prev) => prev.map((t) => map.get(t.id) ?? t))
        setMissingIds((prev) => new Set([...prev].filter((id) => !map.has(id))))
        toast.success(`Relinked ${plural(relinked.length, 'moved song')}`)
      }

      const added = await runImport(itemsFromScanned(scanned))
      const ids = new Map([...tracksRef.current, ...relinked, ...added].map((t) => [t.fingerprint, t.id]))
      return scanned.map((f) => ids.get(fingerprintOf(f))).filter((id): id is string => !!id)
    },
    [runImport],
  )

  const pickWith = useCallback(
    (picker: () => Promise<string[]>) => {
      picker()
        .then((paths) => (paths.length ? importPaths(paths) : undefined))
        .catch((err) => toast.error('Could not open the file picker', { description: errorText(err) }))
    },
    [importPaths],
  )

  const pickFiles = useCallback(() => {
    if (isDesktop) pickWith(pickAudioFiles)
    else fileInput.current?.click()
  }, [pickWith])
  const pickFolder = useCallback(() => {
    if (isDesktop) pickWith(pickMusicFolders)
    else folderInput.current?.click()
  }, [pickWith])

  const importDropped = useCallback(
    async (dt: DataTransfer) => {
      const items = await itemsFromDataTransfer(dt)
      await runImport(items)
    },
    [runImport],
  )

  const checkMissing = useCallback(async () => {
    await refreshMissing(tracksRef.current)
  }, [refreshMissing])

  const removeTracks = useCallback(async (ids: string[]) => {
    const remove = new Set(ids)
    const remaining = tracksRef.current.filter((t) => !remove.has(t.id))
    const stillUsed = new Set(remaining.map((t) => t.artworkId).filter(Boolean))
    const orphans = Array.from(
      new Set(
        tracksRef.current
          .filter((t) => remove.has(t.id) && t.artworkId && !stillUsed.has(t.artworkId))
          .map((t) => t.artworkId!),
      ),
    )
    await db.deleteTracks(ids, orphans)
    setTracks(remaining)
    setMissingIds((prev) => (prev.size ? new Set([...prev].filter((id) => !remove.has(id))) : prev))
    revokeArtwork(orphans)
  }, [])

  const clearLibrary = useCallback(async () => {
    await db.clearLibrary()
    revokeAllArtwork()
    setTracks([])
    setMissingIds(new Set())
  }, [])

  const markPlayed = useCallback((id: string) => {
    const t = tracksRef.current.find((x) => x.id === id)
    if (!t) return
    const updated: Track = { ...t, lastPlayedAt: Date.now(), playCount: t.playCount + 1 }
    setTracks((prev) => prev.map((x) => (x.id === id ? updated : x)))
    void db.updateTracks([updated])
  }, [])

  const clearHistory = useCallback(async () => {
    const updated = tracksRef.current.map((t) => ({ ...t, lastPlayedAt: null, playCount: 0 }))
    await db.updateTracks(updated)
    setTracks(updated)
  }, [])

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])
  const albums = useMemo(() => groupAlbums(tracks), [tracks])
  const albumsById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums])
  const folders = useMemo(() => groupFolders(tracks), [tracks])
  const foldersById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])

  const value = useMemo<LibraryContextValue>(
    () => ({
      ready,
      tracks,
      byId,
      albums,
      albumsById,
      folders,
      foldersById,
      progress,
      missingIds,
      pickFiles,
      pickFolder,
      importDropped,
      importPaths,
      checkMissing,
      removeTracks,
      clearLibrary,
      markPlayed,
      clearHistory,
    }),
    [
      ready,
      tracks,
      byId,
      albums,
      albumsById,
      folders,
      foldersById,
      progress,
      missingIds,
      pickFiles,
      pickFolder,
      importDropped,
      importPaths,
      checkMissing,
      removeTracks,
      clearLibrary,
      markPlayed,
      clearHistory,
    ],
  )

  return (
    <LibraryContext.Provider value={value}>
      {children}
      {!isDesktop && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={AUDIO_ACCEPT}
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              void runImport(itemsFromFiles(files))
            }}
          />
          <input
            ref={folderInput}
            type="file"
            multiple
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              void runImport(itemsFromFiles(files))
            }}
          />
        </>
      )}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}
