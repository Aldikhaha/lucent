import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../state/PlayerContext'
import { useLibrary } from '../state/LibraryContext'
import { usePrefs } from '../state/PrefsContext'
import { useUi } from '../state/UiContext'

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play / pause' },
  { keys: '.', action: 'Stop' },
  { keys: 'Ctrl →  /  Ctrl ←', action: 'Next / previous song' },
  { keys: '→  /  ←', action: 'Seek forward / back 5 s' },
  { keys: 'Ctrl ↑  /  Ctrl ↓', action: 'Volume up / down' },
  { keys: 'M', action: 'Mute' },
  { keys: 'S', action: 'Shuffle' },
  { keys: 'R', action: 'Cycle loop mode (off → queue → song)' },
  { keys: 'Q', action: 'Show / hide queue' },
  { keys: 'N', action: 'Open / close Now Playing' },
  { keys: 'Ctrl K  or  /', action: 'Search' },
  { keys: 'Ctrl O', action: 'Import files' },
  { keys: 'Ctrl Shift O', action: 'Import folder' },
  { keys: 'Ctrl B', action: 'Collapse sidebar' },
  { keys: 'Esc', action: 'Close panel' },
]

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useKeyboardShortcuts() {
  const engine = usePlayer()
  const { pickFiles, pickFolder } = useLibrary()
  const { prefs, setPref } = usePrefs()
  const ui = useUi()
  const navigate = useNavigate()

  useEffect(() => {
    const focusSearch = () => {
      navigate('/search')
      requestAnimationFrame(() => ui.searchInputRef.current?.focus())
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key

      // Shortcuts that also work while typing
      if (ctrl && key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
        return
      }
      if (ctrl && key.toLowerCase() === 'o') {
        e.preventDefault()
        if (e.shiftKey) pickFolder()
        else pickFiles()
        return
      }
      if (isTyping(e.target)) return
      // Leave keys alone while a menu or dialog has focus
      if (document.querySelector('[role="menu"], [role="alertdialog"]')) return

      if (key === 'Escape') {
        if (ui.nowPlayingOpen) ui.setNowPlayingOpen(false)
        else if (ui.queueOpen) ui.setQueueOpen(false)
        return
      }

      const target = e.target as HTMLElement | null
      const onInteractive = !!target?.closest('button, a, [role="slider"], [role="tab"]')

      const handlers: Record<string, () => void> = {}
      if (ctrl) {
        handlers['ArrowRight'] = () => engine.next()
        handlers['ArrowLeft'] = () => engine.previous()
        handlers['ArrowUp'] = () => engine.setVolume(engine.getState().volume + 0.05)
        handlers['ArrowDown'] = () => engine.setVolume(engine.getState().volume - 0.05)
        handlers['b'] = () => setPref('sidebarCollapsed', !prefs.sidebarCollapsed)
      } else if (!e.altKey) {
        if (!onInteractive) handlers[' '] = () => engine.toggle()
        handlers['ArrowRight'] = () => engine.seekBy(5)
        handlers['ArrowLeft'] = () => engine.seekBy(-5)
        handlers['.'] = () => engine.stop()
        handlers['m'] = () => engine.toggleMute()
        handlers['s'] = () => engine.toggleShuffle()
        handlers['r'] = () => engine.cycleRepeat()
        handlers['q'] = () => ui.setQueueOpen(!ui.queueOpen)
        handlers['n'] = () => {
          if (engine.currentId) ui.setNowPlayingOpen(!ui.nowPlayingOpen)
        }
        handlers['/'] = focusSearch
      }
      const fn = handlers[key.length === 1 ? key.toLowerCase() : key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, pickFiles, pickFolder, prefs.sidebarCollapsed, setPref, ui, navigate])
}
