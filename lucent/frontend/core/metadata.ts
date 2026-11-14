import { emptyTags, type ParsedTags } from './types'
import { ascii, BlobRangeReader, type RangeReader } from './tags/bytes'
import { id3v2Length, parseId3v1, parseId3v2 } from './tags/id3'
import { parseFlac, parseOgg } from './tags/flac'
import { parseMp4 } from './tags/mp4'

/** Reads embedded tags (ID3, FLAC/Vorbis, MP4, Ogg) without loading the whole file. */
export async function readTags(source: Blob | RangeReader): Promise<ParsedTags> {
  const tags = emptyTags()
  const r: RangeReader = source instanceof Blob ? new BlobRangeReader(source) : source
  try {
    const head = await r.read(0, 128 * 1024)
    let offset = 0
    const id3Len = id3v2Length(head)
    if (id3Len) {
      const buf = id3Len <= head.length ? head.subarray(0, id3Len) : await r.read(0, id3Len)
      parseId3v2(buf, tags)
      offset = id3Len
    }
    const sig = offset + 12 <= head.length ? head.subarray(offset, offset + 12) : await r.read(offset, 12)
    if (ascii(sig, 0, 4) === 'fLaC') await parseFlac(r, offset, tags)
    else if (ascii(sig, 4, 4) === 'ftyp') await parseMp4(r, tags)
    else if (ascii(sig, 0, 4) === 'OggS') parseOgg(head, tags)
    else if (!tags.title && r.size > 128) parseId3v1(await r.read(r.size - 128, 128), tags)
  } catch (err) {
    console.warn('[lucent] tag parsing failed', err)
  }
  return tags
}

export interface ProbeResult {
  playable: boolean
  duration: number
}

/** Uses the platform decoder to confirm the file plays and read its duration. */
export async function probeAudio(blob: Blob): Promise<ProbeResult> {
  const url = URL.createObjectURL(blob)
  try {
    return await probeAudioUrl(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Same as probeAudio, for a URL the webview can stream (desktop: asset protocol). */
export function probeAudioUrl(url: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const audio = new Audio()
    let settled = false
    const finish = (playable: boolean, duration: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      audio.removeAttribute('src')
      audio.load()
      resolve({ playable, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 })
    }
    const timer = setTimeout(() => finish(true, 0), 10000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity) {
        // Some containers only report duration after seeking to the end.
        audio.ondurationchange = () => {
          if (Number.isFinite(audio.duration)) finish(true, audio.duration)
        }
        audio.currentTime = 1e9
      } else {
        finish(true, audio.duration)
      }
    }
    audio.onerror = () => finish(false, 0)
    audio.src = url
  })
}

/** Derives title/artist/track number from a filename like "03 - Artist - Title.mp3". */
export function parseFileName(fileName: string): { title: string; artist: string | null; trackNo: number | null } {
  let base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim()
  let trackNo: number | null = null
  const num = base.match(/^(\d{1,3})[\s.\-)]+(.+)$/)
  if (num) {
    trackNo = parseInt(num[1]!, 10) || null
    base = num[2]!.trim()
  }
  const parts = base.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0]!.trim(), title: parts.slice(1).join(' - ').trim(), trackNo }
  }
  return { title: base || fileName, artist: null, trackNo }
}
