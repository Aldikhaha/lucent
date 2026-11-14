import type { ArtworkRecord, Track } from './types'

/**
 * Local library storage (IndexedDB).
 * - tracks:  metadata records (small, loaded at startup)
 * - audio:   the imported audio file blobs, keyed by track id (loaded on demand)
 * - artwork: downscaled cover images, deduplicated by content hash
 */
const DB_NAME = 'lucent-library'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio')
      if (!db.objectStoreNames.contains('artwork')) db.createObjectStore('artwork', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await openDb()
  return request(db.transaction('tracks').objectStore('tracks').getAll() as IDBRequest<Track[]>)
}

export async function getAllArtworkIds(): Promise<string[]> {
  const db = await openDb()
  const keys = await request(db.transaction('artwork').objectStore('artwork').getAllKeys())
  return keys.map(String)
}

/** Stores a track, its audio (web only; desktop references files on disk) and new artwork atomically. */
export async function addTrack(track: Track, audio: Blob | null, artwork: ArtworkRecord | null): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['tracks', 'audio', 'artwork'], 'readwrite')
  tx.objectStore('tracks').put(track)
  if (audio) tx.objectStore('audio').put(audio, track.id)
  if (artwork) tx.objectStore('artwork').put(artwork)
  await done(tx)
}

export async function updateTracks(tracks: Track[]): Promise<void> {
  if (!tracks.length) return
  const db = await openDb()
  const tx = db.transaction('tracks', 'readwrite')
  const store = tx.objectStore('tracks')
  for (const t of tracks) store.put(t)
  await done(tx)
}

export async function getAudio(trackId: string): Promise<Blob | undefined> {
  const db = await openDb()
  return request(db.transaction('audio').objectStore('audio').get(trackId) as IDBRequest<Blob | undefined>)
}

export async function getArtwork(id: string): Promise<ArtworkRecord | undefined> {
  const db = await openDb()
  return request(db.transaction('artwork').objectStore('artwork').get(id) as IDBRequest<ArtworkRecord | undefined>)
}

export async function deleteTracks(trackIds: string[], artworkIds: string[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['tracks', 'audio', 'artwork'], 'readwrite')
  for (const id of trackIds) {
    tx.objectStore('tracks').delete(id)
    tx.objectStore('audio').delete(id)
  }
  for (const id of artworkIds) tx.objectStore('artwork').delete(id)
  await done(tx)
}

export async function clearLibrary(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['tracks', 'audio', 'artwork'], 'readwrite')
  tx.objectStore('tracks').clear()
  tx.objectStore('audio').clear()
  tx.objectStore('artwork').clear()
  await done(tx)
}
