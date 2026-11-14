import type { ParsedTags } from '../types'
import { ascii, cleanText, decodeUtf8, type RangeReader, u32be } from './bytes'

type AtomVisitor = (type: string, start: number, end: number) => void

/** Iterate child atoms inside [start, end) of a buffer. `start`/`end` passed to cb are content bounds. */
function eachAtom(b: Uint8Array, start: number, end: number, cb: AtomVisitor): void {
  let p = start
  while (p + 8 <= end) {
    let len = u32be(b, p)
    const type = ascii(b, p + 4, 4)
    let hdr = 8
    if (len === 1) {
      len = u32be(b, p + 8) * 4294967296 + u32be(b, p + 12)
      hdr = 16
    } else if (len === 0) {
      len = end - p
    }
    if (len < hdr || p + len > end) break
    cb(type, p + hdr, p + len)
    p += len
  }
}

function readIlst(b: Uint8Array, start: number, end: number, tags: ParsedTags): void {
  eachAtom(b, start, end, (key, s, e) => {
    eachAtom(b, s, e, (inner, ds, de) => {
      if (inner !== 'data' || de - ds < 8) return
      const dataType = u32be(b, ds) & 0xffffff
      const value = b.subarray(ds + 8, de)
      const text = () => cleanText(decodeUtf8(value))
      switch (key) {
        case '\u00a9nam':
          tags.title ??= text()
          break
        case '\u00a9ART':
          tags.artist ??= text()
          break
        case '\u00a9alb':
          tags.album ??= text()
          break
        case 'aART':
          tags.albumArtist ??= text()
          break
        case '\u00a9day':
          tags.year ??= parseInt(text()?.slice(0, 4) ?? '', 10) || null
          break
        case '\u00a9lyr':
          tags.lyrics ??= cleanText(text()?.replace(/\r\n?/g, '\n'))
          break
        case 'trkn':
          if (value.length >= 4) tags.trackNo ??= ((value[2]! << 8) | value[3]!) || null
          break
        case 'covr':
          if (!tags.picture && value.length > 64) {
            tags.picture = { data: value, mime: dataType === 14 ? 'image/png' : 'image/jpeg', type: 3 }
          }
          break
      }
    })
  })
}

function readMoov(b: Uint8Array, tags: ParsedTags): void {
  eachAtom(b, 0, b.length, (type, s, e) => {
    if (type === 'mvhd') {
      const v = b[s]!
      const timescale = v === 1 ? u32be(b, s + 20) : u32be(b, s + 12)
      const duration = v === 1 ? u32be(b, s + 24) * 4294967296 + u32be(b, s + 28) : u32be(b, s + 16)
      if (timescale > 0 && duration > 0) tags.duration = duration / timescale
    } else if (type === 'udta') {
      eachAtom(b, s, e, (t2, s2, e2) => {
        if (t2 !== 'meta') return
        // 'meta' is usually a full box (4 bytes version/flags) — QuickTime variants are not.
        const offset = ascii(b, s2 + 4, 4) === 'hdlr' ? 0 : 4
        eachAtom(b, s2 + offset, e2, (t3, s3, e3) => {
          if (t3 === 'ilst') readIlst(b, s3, e3, tags)
        })
      })
    }
  })
}

/** MP4 / M4A metadata: walks top-level atoms and reads only the 'moov' box. */
export async function parseMp4(r: RangeReader, tags: ParsedTags): Promise<void> {
  let pos = 0
  for (let i = 0; i < 64 && pos + 8 <= r.size; i++) {
    const h = await r.read(pos, 16)
    let len = u32be(h, 0)
    const type = ascii(h, 4, 4)
    let hdr = 8
    if (len === 1) {
      len = u32be(h, 8) * 4294967296 + u32be(h, 12)
      hdr = 16
    } else if (len === 0) {
      len = r.size - pos
    }
    if (len < hdr) break
    if (type === 'moov') {
      if (len > 48 * 1024 * 1024) break
      readMoov(await r.read(pos + hdr, len - hdr), tags)
      break
    }
    pos += len
  }
}
