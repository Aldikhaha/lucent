import type { Track } from './types'

/** Conservative matching for likely duplicate recordings. Never deletes library files. */
export function recordingIdentity(t: Track | undefined): { key: string; duration: number } | null {
  if (!t || !Number.isFinite(t.duration) || t.duration <= 0) return null
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  const title = normalize(t.title || '')
  const artist = normalize(t.artist || '')
  if (!title || !artist || artist === 'unknown artist' || title === 'unknown title') return null
  return { key: JSON.stringify([title, artist]), duration: t.duration }
}
