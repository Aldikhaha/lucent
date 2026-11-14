import type { ArtworkRecord, Hsl, Track } from './types'
import { addTrack } from './db'
import { parseFileName, probeAudio, probeAudioUrl, readTags } from './metadata'
import { processArtwork } from './artwork'
import { hashBytes } from './format'
import { AUDIO_EXTENSIONS, extOf, isAudioFile } from './audioFormats'
import { FileRangeReader, fileUrl, type ScannedFile } from './platform/desktop'

export { AUDIO_EXTENSIONS, isAudioFile }
export const AUDIO_ACCEPT = [...AUDIO_EXTENSIONS.map((e) => `.${e}`), 'audio/*'].join(',')

/**
 * One file to import. In the browser it carries the File (its bytes get copied into IndexedDB);
 * on desktop it carries an absolute path and the file is referenced in place.
 */
export interface ImportItem {
  name: string
  size: number
  /** Last modified, ms since epoch */
  modified: number
  /** Relative folder path, e.g. "Music/Album" ("" for loose files) */
  folder: string
  file?: File
  path?: string
}

export interface ImportProgress {
  total: number
  processed: number
  added: number
  skipped: number
  failed: number
  current: string
}

const dirname = (path: string) => {
  const clean = path.replace(/^\/+/, '')
  const i = clean.lastIndexOf('/')
  return i > 0 ? clean.slice(0, i) : ''
}

const fromFile = (file: File, folder: string): ImportItem => ({
  name: file.name,
  size: file.size,
  modified: file.lastModified,
  folder,
  file,
})

/** From an <input type="file"> (with or without webkitdirectory). */
export function itemsFromFiles(files: Iterable<File>): ImportItem[] {
  const out: ImportItem[] = []
  for (const file of files) {
    if (!isAudioFile(file.name)) continue
    out.push(fromFile(file, dirname(file.webkitRelativePath || '')))
  }
  return out
}

/** From the desktop scanner (absolute paths). */
export function itemsFromScanned(files: ScannedFile[]): ImportItem[] {
  return files
    .filter((f) => isAudioFile(f.name))
    .map((f) => ({ name: f.name, size: f.size, modified: f.modified, folder: f.folder, path: f.path }))
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(all)
        else {
          all.push(...batch)
          next()
        }
      }, reject)
    next()
  })
}

async function walkEntry(entry: FileSystemEntry, out: ImportItem[]): Promise<void> {
  if (entry.isFile) {
    if (!isAudioFile(entry.name)) return
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    out.push(fromFile(file, dirname(entry.fullPath)))
  } else if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
    for (const child of children) await walkEntry(child, out)
  }
}

/** From a drag-and-drop event — recursively reads dropped folders. */
export async function itemsFromDataTransfer(dt: DataTransfer): Promise<ImportItem[]> {
  // Entries must be captured synchronously, before any await.
  const entries: FileSystemEntry[] = []
  const looseFiles: File[] = []
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const f = item.getAsFile()
      if (f) looseFiles.push(f)
    }
  }
  const out: ImportItem[] = itemsFromFiles(looseFiles)
  for (const entry of entries) {
    try {
      await walkEntry(entry, out)
    } catch (err) {
      console.warn('[lucent] could not read dropped entry', entry.name, err)
    }
  }
  return out
}

export const fingerprintOf = (item: Pick<ImportItem, 'name' | 'size' | 'modified'>) =>
  `${item.name}|${item.size}|${item.modified}`

export interface ImportContext {
  fingerprints: Set<string>
  /** artwork id -> accent, for artwork already in the library */
  artwork: Map<string, Hsl | null>
}

async function importOne(item: ImportItem, ctx: ImportContext): Promise<Track | 'skipped' | 'failed'> {
  const { name, folder } = item
  const fingerprint = fingerprintOf(item)
  if (ctx.fingerprints.has(fingerprint)) return 'skipped'
  ctx.fingerprints.add(fingerprint)

  const [tags, probe] = item.path
    ? await Promise.all([readTags(new FileRangeReader(item.path, item.size)), probeAudioUrl(fileUrl(item.path))])
    : item.file
      ? await Promise.all([readTags(item.file), probeAudio(item.file)])
      : [null, { playable: false, duration: 0 }]
  if (!tags || !probe.playable) {
    ctx.fingerprints.delete(fingerprint)
    return 'failed'
  }

  let artworkId: string | null = null
  let accent: Hsl | null = null
  let newArtwork: ArtworkRecord | null = null
  if (tags.picture) {
    const id = hashBytes(tags.picture.data)
    if (ctx.artwork.has(id)) {
      artworkId = id
      accent = ctx.artwork.get(id) ?? null
    } else {
      const processed = await processArtwork(tags.picture.data, tags.picture.mime)
      if (processed) {
        artworkId = id
        accent = processed.accent
        newArtwork = { id, blob: processed.blob, accent }
        ctx.artwork.set(id, accent)
      }
    }
  }

  const fromName = parseFileName(name)
  const folderName = folder.split('/').pop() || ''
  const artist = tags.artist ?? fromName.artist ?? 'Unknown Artist'
  const track: Track = {
    id: crypto.randomUUID(),
    title: tags.title ?? fromName.title,
    artist,
    album: tags.album ?? (folderName || 'Unknown Album'),
    albumArtist: tags.albumArtist ?? artist,
    trackNo: tags.trackNo ?? fromName.trackNo,
    year: tags.year,
    duration: tags.duration ?? probe.duration,
    folder,
    fileName: name,
    size: item.size,
    mime: item.file?.type || `audio/${extOf(name)}`,
    format: extOf(name).toUpperCase(),
    artworkId,
    accent,
    lyrics: tags.lyrics,
    addedAt: Date.now(),
    lastPlayedAt: null,
    playCount: 0,
    fingerprint,
    ...(item.path ? { path: item.path } : {}),
  }
  await addTrack(track, item.file ?? null, newArtwork)
  return track
}

/** Imports files with a small concurrency limit, reporting progress and each added track. */
export async function importItems(
  items: ImportItem[],
  ctx: ImportContext,
  onProgress: (p: ImportProgress) => void,
  onTrack: (t: Track) => void,
): Promise<ImportProgress> {
  const progress: ImportProgress = { total: items.length, processed: 0, added: 0, skipped: 0, failed: 0, current: '' }
  onProgress({ ...progress })
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!
      progress.current = item.name
      try {
        const result = await importOne(item, ctx)
        if (result === 'skipped') progress.skipped++
        else if (result === 'failed') progress.failed++
        else {
          progress.added++
          onTrack(result)
        }
      } catch (err) {
        console.warn('[lucent] import failed', item.name, err)
        progress.failed++
      }
      progress.processed++
      onProgress({ ...progress })
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return progress
}
