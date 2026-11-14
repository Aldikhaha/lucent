/**
 * Desktop (Tauri 2) bridge. Every function here talks to the Rust side in desktop/src-tauri and must
 * only be called when `isDesktop` is true.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { AUDIO_EXTENSIONS } from '../audioFormats'
import type { RangeReader } from '../tags/bytes'

export interface ScannedFile {
  /** Absolute path */
  path: string
  name: string
  /** Relative folder, e.g. "Music/Album" ("" for loose files) */
  folder: string
  size: number
  /** Last modified, ms since epoch */
  modified: number
}

/** Recursively lists audio files under the given files/folders (native walk, no copying). */
export function scanPaths(paths: string[]): Promise<ScannedFile[]> {
  if (!paths.length) return Promise.resolve([])
  return invoke<ScannedFile[]>('scan_paths', { paths })
}

/**
 * Allows the webview to stream these files and reports which ones no longer exist on disk.
 * Returns the paths that are missing.
 */
export function registerLibraryFiles(paths: string[]): Promise<string[]> {
  if (!paths.length) return Promise.resolve([])
  return invoke<string[]>('register_library_files', { paths })
}

/** Files passed on the command line at launch ("Open with Lucent"). Returned once. */
export function takeLaunchFiles(): Promise<string[]> {
  return invoke<string[]>('take_launch_files')
}

export function setTrayTooltip(text: string): Promise<void> {
  return invoke('set_tray_tooltip', { text: text.length > 120 ? `${text.slice(0, 119)}…` : text })
}

/** Random access to a file on disk, used by the existing JS tag parsers. */
export class FileRangeReader implements RangeReader {
  constructor(
    private readonly path: string,
    readonly size: number,
  ) {}

  async read(start: number, length: number): Promise<Uint8Array> {
    const end = Math.min(this.size, start + length)
    if (start >= end || start < 0) return new Uint8Array(0)
    const buf = await invoke<ArrayBuffer>('read_range', { path: this.path, start, length: end - start })
    return new Uint8Array(buf)
  }
}

/** Streamable URL (asset protocol, supports range requests/seeking) for a file on disk. */
export const fileUrl = (path: string) => convertFileSrc(path)

/** Resolves a playable URL for a library file, with a clear error when the file has gone. */
export async function playableUrl(path: string, title: string): Promise<string> {
  const missing = await registerLibraryFiles([path])
  if (missing.length) {
    throw new Error(`"${title}" can't be found. It may have been moved, renamed or deleted.`)
  }
  return fileUrl(path)
}

const normalize = (r: string | string[] | null): string[] => (r ? (Array.isArray(r) ? r : [r]) : [])

export async function pickAudioFiles(): Promise<string[]> {
  const r = await open({
    multiple: true,
    directory: false,
    title: 'Import music files',
    filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
  })
  return normalize(r)
}

export async function pickMusicFolders(): Promise<string[]> {
  const r = await open({ multiple: true, directory: true, recursive: true, title: 'Import music folders' })
  return normalize(r)
}

export function revealInExplorer(path: string): Promise<void> {
  return revealItemInDir(path)
}
