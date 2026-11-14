import type { ParsedTags } from '../types'
import { ascii, cleanText, decodeUtf8, parseLeadingInt, type RangeReader, u24be, u32be, u32le } from './bytes'

function parseFlacPicture(b: Uint8Array, tags: ParsedTags): void {
  let p = 0
  const type = u32be(b, p)
  p += 4
  const mimeLen = u32be(b, p)
  p += 4
  const mime = ascii(b, p, mimeLen) || 'image/jpeg'
  p += mimeLen
  const descLen = u32be(b, p)
  p += 4 + descLen + 16
  const dataLen = u32be(b, p)
  p += 4
  const data = b.subarray(p, p + dataLen)
  if (data.length < 64) return
  if (!tags.picture || (type === 3 && tags.picture.type !== 3)) tags.picture = { data, mime, type }
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Vorbis comment block (used by FLAC, Ogg Vorbis and Opus). */
export function parseVorbisComment(b: Uint8Array, tags: ParsedTags): void {
  let p = 0
  const vendorLen = u32le(b, p)
  p += 4 + vendorLen
  const count = u32le(b, p)
  p += 4
  for (let i = 0; i < count && p + 4 <= b.length; i++) {
    const len = u32le(b, p)
    p += 4
    if (p + len > b.length) break
    const entry = decodeUtf8(b.subarray(p, p + len))
    p += len
    const eq = entry.indexOf('=')
    if (eq < 0) continue
    const key = entry.slice(0, eq).toUpperCase()
    const value = entry.slice(eq + 1)
    switch (key) {
      case 'TITLE':
        tags.title ??= cleanText(value)
        break
      case 'ARTIST':
        tags.artist ??= cleanText(value)
        break
      case 'ALBUM':
        tags.album ??= cleanText(value)
        break
      case 'ALBUMARTIST':
      case 'ALBUM ARTIST':
        tags.albumArtist ??= cleanText(value)
        break
      case 'TRACKNUMBER':
        tags.trackNo ??= parseLeadingInt(value.split('/')[0] ?? null)
        break
      case 'DATE':
      case 'YEAR':
        tags.year ??= parseLeadingInt(value.slice(0, 4))
        break
      case 'LYRICS':
      case 'UNSYNCEDLYRICS':
        tags.lyrics ??= cleanText(value.replace(/\r\n?/g, '\n'))
        break
      case 'METADATA_BLOCK_PICTURE':
        try {
          parseFlacPicture(base64ToBytes(value), tags)
        } catch {
          /* ignore malformed picture */
        }
        break
    }
  }
}

export async function parseFlac(r: RangeReader, start: number, tags: ParsedTags): Promise<void> {
  let pos = start + 4
  for (let i = 0; i < 128; i++) {
    const h = await r.read(pos, 4)
    if (h.length < 4) break
    const last = (h[0]! & 0x80) !== 0
    const type = h[0]! & 0x7f
    const len = u24be(h, 1)
    pos += 4
    if (type === 0 || type === 4 || type === 6) {
      const b = await r.read(pos, len)
      if (type === 0 && b.length >= 18) {
        const sampleRate = (b[10]! << 12) | (b[11]! << 4) | (b[12]! >> 4)
        const total = (b[13]! & 0x0f) * 4294967296 + u32be(b, 14)
        if (sampleRate > 0 && total > 0) tags.duration = total / sampleRate
      } else if (type === 4) {
        parseVorbisComment(b, tags)
      } else if (type === 6) {
        parseFlacPicture(b, tags)
      }
    }
    pos += len
    if (last) break
  }
}

/** Best-effort Ogg Vorbis / Opus comment parsing from the start of the file. */
export function parseOgg(head: Uint8Array, tags: ParsedTags): void {
  const text = ascii(head, 0, head.length)
  let idx = text.indexOf('\u0003vorbis')
  let skip = 7
  if (idx < 0) {
    idx = text.indexOf('OpusTags')
    skip = 8
  }
  if (idx < 0) return
  try {
    parseVorbisComment(head.subarray(idx + skip), tags)
  } catch {
    /* comment spans multiple pages; ignore */
  }
}
