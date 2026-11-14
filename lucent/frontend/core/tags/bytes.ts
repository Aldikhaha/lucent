/** Random-access byte source. Tag parsers only load the ranges they request. */
export interface RangeReader {
  readonly size: number
  read(start: number, length: number): Promise<Uint8Array>
}

/** RangeReader over a Blob/File (browser prototype). */
export class BlobRangeReader implements RangeReader {
  readonly size: number
  constructor(private readonly blob: Blob) {
    this.size = blob.size
  }

  async read(start: number, length: number): Promise<Uint8Array> {
    const end = Math.min(this.size, start + length)
    if (start >= end || start < 0) return new Uint8Array(0)
    return new Uint8Array(await this.blob.slice(start, end).arrayBuffer())
  }
}

const latin1 = new TextDecoder('windows-1252')
const utf8 = new TextDecoder('utf-8')

export function ascii(b: Uint8Array, start: number, len: number): string {
  return latin1.decode(b.subarray(start, start + len))
}

export function decodeLatin1(b: Uint8Array): string {
  return latin1.decode(b)
}

export function decodeUtf8(b: Uint8Array): string {
  return utf8.decode(b)
}

export function u32be(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!
}

export function u32le(b: Uint8Array, o: number): number {
  return ((b[o + 3]! << 24) >>> 0) + (b[o + 2]! << 16) + (b[o + 1]! << 8) + b[o]!
}

export function u24be(b: Uint8Array, o: number): number {
  return (b[o]! << 16) + (b[o + 1]! << 8) + b[o + 2]!
}

export function cleanText(s: string | null | undefined): string | null {
  if (!s) return null
  const v = s.replace(/\0+/g, ' ').trim()
  return v.length ? v : null
}

export function parseLeadingInt(s: string | null): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
