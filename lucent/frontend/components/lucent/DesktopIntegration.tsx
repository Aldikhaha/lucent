import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { setTrayTooltip, takeLaunchFiles } from '../../core/platform/desktop'
import { useLibrary } from '../../state/LibraryContext'
import { useCurrentTrack, usePlayer, usePlayerState } from '../../state/PlayerContext'
import { usePrefs } from '../../state/PrefsContext'
import { disposer } from './desktopEvents'

/**
 * Desktop-only glue between the native shell and the player (renders nothing):
 * - system tray menu actions and tooltip
 * - global media keys (play/pause, next, previous, stop)
 * - close-to-tray
 * - "Open with Lucent" / files passed on launch or to a second instance: import, then play
 */
export function DesktopIntegration() {
  const engine = usePlayer()
  const track = useCurrentTrack()
  const { status } = usePlayerState()
  const { ready, byId, importPaths } = useLibrary()
  const { prefs } = usePrefs()
  const closeToTray = useRef(prefs.closeToTray)
  closeToTray.current = prefs.closeToTray
  const [pendingPlay, setPendingPlay] = useState<string[] | null>(null)

  // Tray menu → player
  useEffect(
    () =>
      disposer(
        listen<string>('lucent:tray', ({ payload }) => {
          if (payload === 'toggle') engine.toggle()
          else if (payload === 'next') engine.next()
          else if (payload === 'previous') engine.previous()
          else if (payload === 'stop') engine.stop()
        }),
      ),
    [engine],
  )

  // Close button / Alt+F4: hide to tray when enabled (tray "Quit" always exits).
  useEffect(() => {
    const win = getCurrentWindow()
    return disposer(
      win.onCloseRequested((event) => {
        if (!closeToTray.current) return
        event.preventDefault()
        void win.hide()
      }),
    )
  }, [])

  // Global media keys
  useEffect(() => {
    if (!prefs.mediaKeys) return
    const bindings: [string, () => void][] = [
      ['MediaPlayPause', () => engine.toggle()],
      ['MediaTrackNext', () => engine.next()],
      ['MediaTrackPrevious', () => engine.previous()],
      ['MediaStop', () => engine.stop()],
    ]
    let cancelled = false
    const registered: string[] = []
    void (async () => {
      for (const [key, run] of bindings) {
        if (cancelled) return
        try {
          await unregister(key).catch(() => undefined)
          await register(key, (e) => {
            if (e.state === 'Pressed') run()
          })
          registered.push(key)
        } catch (err) {
          // Another app may own the key; the in-app shortcuts still work.
          console.warn('[lucent] could not register media key', key, err)
        }
      }
      if (cancelled && registered.length) void unregister(registered).catch(() => undefined)
    })()
    return () => {
      cancelled = true
      if (registered.length) void unregister(registered.splice(0)).catch(() => undefined)
    }
  }, [prefs.mediaKeys, engine])

  // Files opened from Explorer
  const openFiles = useCallback(
    async (paths: string[]) => {
      const ids = await importPaths(paths)
      if (ids.length) setPendingPlay(ids)
    },
    [importPaths],
  )

  const launchHandled = useRef(false)
  useEffect(() => {
    // Wait for the library so duplicate detection sees existing songs.
    if (!ready || launchHandled.current) return
    launchHandled.current = true
    takeLaunchFiles()
      .then((paths) => (paths.length ? openFiles(paths) : undefined))
      .catch(() => undefined)
  }, [ready, openFiles])

  useEffect(() => disposer(listen<string[]>('lucent:open-files', ({ payload }) => void openFiles(payload))), [openFiles])

  // Start playback once newly imported tracks are in the library state.
  useEffect(() => {
    if (!pendingPlay || !pendingPlay.every((id) => byId.has(id))) return
    engine.playQueue(pendingPlay, 0, pendingPlay.length === 1 ? 'Opened file' : 'Opened files')
    setPendingPlay(null)
  }, [pendingPlay, byId, engine])

  // Tray tooltip mirrors what's playing
  const tooltip = track ? `${track.title} — ${track.artist}${status === 'playing' || status === 'loading' ? '' : ' (paused)'}` : 'Lucent'
  useEffect(() => {
    setTrayTooltip(tooltip).catch(() => undefined)
  }, [tooltip])

  return null
}
