/** File extensions Lucent imports. Shared by the web importer and the desktop file dialogs. */
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'webm']

export const extOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

export function isAudioFile(name: string): boolean {
  return !name.startsWith('.') && AUDIO_EXTENSIONS.includes(extOf(name))
}
