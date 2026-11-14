import type { Hsl } from './types'
import { getArtwork } from './db'

const MAX_ART_SIZE = 600

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

/** Picks the dominant "characterful" hue: buckets pixels by hue, weighted by saturation and mid-lightness. */
function extractAccent(data: Uint8ClampedArray): Hsl | null {
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, x: 0, y: 0, s: 0, l: 0 }))
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue
    const [h, s, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!)
    const w = (s / 100) * (1 - Math.abs(l - 50) / 50)
    total++
    if (w <= 0.05) continue
    const bucket = buckets[Math.floor(h / 30) % 12]!
    const rad = (h * Math.PI) / 180
    bucket.w += w
    bucket.x += Math.cos(rad) * w
    bucket.y += Math.sin(rad) * w
    bucket.s += s * w
    bucket.l += l * w
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a))
  if (!total || best.w / total < 0.04) return null
  const hue = (Math.atan2(best.y, best.x) * 180) / Math.PI
  return [Math.round((hue + 360) % 360), Math.round(best.s / best.w), Math.round(best.l / best.w)]
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
}

/** Downscales embedded cover art to a light JPEG and extracts an accent color. */
export async function processArtwork(data: Uint8Array, mime: string): Promise<{ blob: Blob; accent: Hsl | null } | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: mime }))
  } catch {
    return null
  }
  try {
    const scale = Math.min(1, MAX_ART_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas)
    if (!blob) return null

    const sample = document.createElement('canvas')
    sample.width = 32
    sample.height = 32
    const sctx = sample.getContext('2d', { willReadFrequently: true })
    let accent: Hsl | null = null
    if (sctx) {
      sctx.drawImage(bitmap, 0, 0, 32, 32)
      accent = extractAccent(sctx.getImageData(0, 0, 32, 32).data)
    }
    return { blob, accent }
  } finally {
    bitmap.close()
  }
}

/* ------------------------------------------------------------------ */
/* Object URL cache for stored artwork (loaded lazily, kept per session) */

const urlCache = new Map<string, Promise<string | null>>()
const resolved = new Map<string, string | null>()

export function getArtworkUrl(id: string): Promise<string | null> {
  let p = urlCache.get(id)
  if (!p) {
    p = getArtwork(id)
      .then((rec) => (rec ? URL.createObjectURL(rec.blob) : null))
      .catch(() => null)
      .then((url) => {
        resolved.set(id, url)
        return url
      })
    urlCache.set(id, p)
  }
  return p
}

/** Synchronous lookup for already-loaded artwork (avoids flicker on re-render). */
export function peekArtworkUrl(id: string): string | null | undefined {
  return resolved.get(id)
}

export function revokeArtwork(ids: Iterable<string>): void {
  for (const id of ids) {
    const url = resolved.get(id)
    if (url) URL.revokeObjectURL(url)
    resolved.delete(id)
    urlCache.delete(id)
  }
}

export function revokeAllArtwork(): void {
  revokeArtwork(Array.from(resolved.keys()))
  urlCache.clear()
}
