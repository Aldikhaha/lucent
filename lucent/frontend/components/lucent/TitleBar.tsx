import { useEffect, useState, type ReactNode } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { cn } from '../../lib/shadcn/utils'
import { disposer } from './desktopEvents'

/** Height of the custom title bar; exposed to CSS as --lc-titlebar-h so overlays can sit below it. */
export const TITLEBAR_HEIGHT = 32

function CaptionButton({
  label,
  onClick,
  close,
  children,
}: {
  label: string
  onClick: () => void
  close?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        'flex h-full w-[46px] items-center justify-center text-foreground/80 transition-colors duration-100 [&_svg]:h-3.5 [&_svg]:w-3.5',
        close ? 'hover:bg-[#c42b1c] hover:text-white' : 'hover:bg-[hsl(var(--lc-hover)/0.08)] hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Frameless-window title bar (desktop only): drag to move, double-click to maximize, Windows-style
 * caption buttons. Transparent so the ambient artwork background shows through.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    const win = getCurrentWindow()
    const root = document.documentElement
    root.style.setProperty('--lc-titlebar-h', `${TITLEBAR_HEIGHT}px`)
    let alive = true
    const sync = () => {
      win
        .isMaximized()
        .then((m) => alive && setMaximized(m))
        .catch(() => undefined)
    }
    sync()
    const offResize = disposer(win.onResized(sync))
    const offFocus = disposer(win.onFocusChanged(({ payload }) => setFocused(payload)))
    return () => {
      alive = false
      offResize()
      offFocus()
      root.style.removeProperty('--lc-titlebar-h')
    }
  }, [])

  const win = getCurrentWindow()
  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[60] flex select-none items-stretch"
      style={{ height: TITLEBAR_HEIGHT }}
    >
      <div
        data-tauri-drag-region
        className={cn(
          'flex flex-1 items-center pl-4 text-[11px] font-semibold tracking-[0.2em] transition-opacity',
          focused ? 'text-muted-foreground' : 'text-muted-foreground opacity-60',
        )}
      >
        <span data-tauri-drag-region className="lc-wordmark">
          LUCENT
        </span>
      </div>
      <div className={cn('flex transition-opacity', !focused && 'opacity-60')}>
        <CaptionButton label="Minimize" onClick={() => void win.minimize()}>
          <Minus strokeWidth={1.5} />
        </CaptionButton>
        <CaptionButton label={maximized ? 'Restore down' : 'Maximize'} onClick={() => void win.toggleMaximize()}>
          {maximized ? <Copy strokeWidth={1.5} className="-scale-x-100" /> : <Square strokeWidth={1.5} />}
        </CaptionButton>
        <CaptionButton label="Close" close onClick={() => void win.close()}>
          <X strokeWidth={1.5} />
        </CaptionButton>
      </div>
    </div>
  )
}
