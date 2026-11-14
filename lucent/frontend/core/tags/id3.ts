import type { ParsedTags } from '../types'
import { ascii, cleanText, decodeLatin1, parseLeadingInt, u24be, u32be } from './bytes'

const syncsafe = (b: Uint8Array, o: number) =>
  ((b[o]! & 0x7f) << 21) | ((b[o + 1]! & 0x7f) << 14) | ((b[o + 2]! & 0x7f) << 7) | (b[o + 3]! & 0x7f)

/** Total length of a leading ID3v2 tag (including header/footer), or 0 if none. */
export function id3v2Length(head: Uint8Array): number {
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return 0
  const footer = (head[5]! & 0x10) !== 0 ? 10 : 0
  return 10 + syncsafe(head, 6) + footer
}

function removeUnsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length)
  let j = 0
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i]!
    if (b[i] === 0xff && b[i + 1] === 0x00) i++
  }
  return out.subarray(0, j)
}

function decodeText(bytes: Uint8Array, enc: number): string {
  let label = 'windows-1252'
  if (enc === 1) label = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-16le'
  else if (enc === 2) label = 'utf-16be'
  else if (enc === 3) label = 'utf-8'
  try {
    return new TextDecoder(label).decode(bytes)
  } catch {
    return decodeLatin1(bytes)
  }
}

/** Index of the string terminator starting at `start` for the given encoding. */
function terminator(b: Uint8Array, start: number, enc: number): number {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i
    return b.length
  }
  const i = b.indexOf(0, start)
  return i === -1 ? b.length : i
}

const termLen = (enc: number) => (enc === 1 || enc === 2 ? 2 : 1)

function multiValue(text: string): string | null {
  return cleanText(
    text
      .split('\0')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', '),
  )
}

const TEXT_FIELDS: Record<string, 'title' | 'artist' | 'album' | 'albumArtist'> = {
  TIT2: 'title',
  TT2: 'title',
  TPE1: 'artist',
  TP1: 'artist',
  TALB: 'album',
  TAL: 'album',
  TPE2: 'albumArtist',
  TP2: 'albumArtist',
}

function handleFrame(id: string, f: Uint8Array, tags: ParsedTags): void {
  if (f.length < 2) return
  const enc = f[0]!
  const field = TEXT_FIELDS[id]
  if (field) {
    if (!tags[field]) tags[field] = multiValue(decodeText(f.subarray(1), enc))
    return
  }
  if (id === 'TRCK' || id === 'TRK') {
    tags.trackNo ??= parseLeadingInt(decodeText(f.subarray(1), enc).split('/')[0] ?? null)
    return
  }
  if (id === 'TYER' || id === 'TYE' || id === 'TDRC' || id === 'TDOR') {
    tags.year ??= parseLeadingInt(decodeText(f.subarray(1), enc).trim().slice(0, 4))
    return
  }
  if (id === 'APIC' || id === 'PIC') {
    let mime: string
    let p: number
    if (id === 'APIC') {
      const mimeEnd = f.indexOf(0, 1)
      if (mimeEnd < 0) return
      mime = ascii(f, 1, mimeEnd - 1).toLowerCase() || 'image/jpeg'
      if (!mime.includes('/')) mime = `image/${mime === 'jpg' ? 'jpeg' : mime}`
      p = mimeEnd + 1
    } else {
      const fmt = ascii(f, 1, 3).toUpperCase()
      mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg'
      p = 4
    }
    const picType = f[p] ?? 0
    const descEnd = terminator(f, p + 1, enc)
    const data = f.subarray(descEnd + termLen(enc))
    if (data.length < 64) return
    if (!tags.picture || (picType === 3 && tags.picture.type !== 3)) {
      tags.picture = { data, mime, type: picType }
    }
    return
  }
  if (id === 'USLT' || id === 'ULT') {
    if (tags.lyrics) return
    const descEnd = terminator(f, 4, enc)
    tags.lyrics = cleanText(decodeText(f.subarray(descEnd + termLen(enc)), enc).replace(/\r\n?/g, '\n'))
  }
}

export function parseId3v2(buf: Uint8Array, tags: ParsedTags): void {
  const major = buf[3]!
  const flags = buf[5]!
  const size = syncsafe(buf, 6)
  let data = buf.subarray(10, Math.min(buf.length, 10 + size))
  if (flags & 0x80 && major < 4) data = removeUnsync(data)

  let pos = 0
  if (flags & 0x40) {
    if (major === 3) pos = 4 + u32be(data, 0)
    else if (major === 4) pos = syncsafe(data, 0)
  }
  const idLen = major === 2 ? 3 : 4
  const headLen = major === 2 ? 6 : 10

  while (pos + headLen <= data.length) {
    const id = ascii(data, pos, idLen)
    if (!/^[A-Z0-9]+$/.test(id)) break
    const fsize = major === 2 ? u24be(data, pos + 3) : major === 4 ? syncsafe(data, pos + 4) : u32be(data, pos + 4)
    const fflags = major >= 3 ? data[pos + 9]! : 0
    pos += headLen
    if (fsize <= 0 || pos + fsize > data.length) break
    let frame = data.subarray(pos, pos + fsize)
    pos += fsize
    if (major === 3 && fflags & 0xc0) continue // compressed / encrypted
    if (major === 4) {
      if (fflags & 0x0c) continue
      if (fflags & 0x01) frame = frame.subarray(4)
      if (fflags & 0x02) frame = removeUnsync(frame)
    }
    handleFrame(id, frame, tags)
  }
}

/** Legacy 128-byte ID3v1 tag at the end of MP3 files. */
export function parseId3v1(tail: Uint8Array, tags: ParsedTags): void {
  if (tail.length !== 128 || ascii(tail, 0, 3) !== 'TAG') return
  const field = (o: number, l: number) => cleanText(decodeLatin1(tail.subarray(o, o + l)))
  tags.title ??= field(3, 30)
  tags.artist ??= field(33, 30)
  tags.album ??= field(63, 30)
  tags.year ??= parseLeadingInt(field(93, 4))
  if (tail[125] === 0 && tail[126]) tags.trackNo ??= tail[126]!
}
