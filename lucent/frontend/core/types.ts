/** HSL tuple: hue 0-360, saturation 0-100, lightness 0-100 */
export type Hsl = [number, number, number]

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  albumArtist: string
  trackNo: number | null
  year: number | null
  /** Seconds */
  duration: number
  /** Relative folder path the file was imported from ("" for loose files) */
  folder: string
  fileName: string
  size: number
  mime: string
  format: string
  artworkId: string | null
  accent: Hsl | null
  lyrics: string | null
  addedAt: number
  lastPlayedAt: number | null
  playCount: number
  /** name|size|lastModified — used to skip duplicate imports */
  fingerprint: string
  /** Desktop only: absolute path of the file on disk. Audio is referenced in place, never copied. */
  path?: string
}

export interface ArtworkRecord {
  id: string
  blob: Blob
  accent: Hsl | null
}

export interface ParsedPicture {
  data: Uint8Array
  mime: string
  type: number
}

export interface ParsedTags {
  title: string | null
  artist: string | null
  album: string | null
  albumArtist: string | null
  trackNo: number | null
  year: number | null
  duration: number | null
  lyrics: string | null
  picture: ParsedPicture | null
}

export function emptyTags(): ParsedTags {
  return {
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    trackNo: null,
    year: null,
    duration: null,
    lyrics: null,
    picture: null,
  }
}

export interface Album {
  id: string
  title: string
  artist: string
  year: number | null
  artworkId: string | null
  accent: Hsl | null
  trackIds: string[]
  duration: number
  addedAt: number
}

export interface Folder {
  id: string
  path: string
  name: string
  trackIds: string[]
  duration: number
}
