import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentWindow, LogicalSize, type PhysicalSize, type PhysicalPosition } from '@tauri-apps/api/window'
import { toast } from 'sonner'
import { useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from '../../lib/shadcn/sonner'
import { cn } from '../../lib/shadcn/utils'
import { isDesktop } from '../../core/platform'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useCurrentTrack } from '../../state/PlayerContext'
import { usePrefs } from '../../state/PrefsContext'
import { useUi } from '../../state/UiContext'
import { AmbientBackground } from './AmbientBackground'
import { DropOverlay } from './DropOverlay'
import { MiniPlayer } from './MiniPlayer'
import { IslandPlayer } from './IslandPlayer'
import { NowPlaying } from './NowPlaying'
import { QueuePanel } from './QueuePanel'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TitleBar } from './TitleBar'
import { DesktopIntegration } from './DesktopIntegration'

function useDocumentTitle() {
  const track = useCurrentTrack()
  useEffect(() => {
    document.title = track ? `${track.title} — ${track.artist} · Lucent` : 'Lucent'
  }, [track])
}

/** Restores the last opened view on launch and remembers navigation afterwards. */
function useRememberLastPath() {
  const location = useLocation()
  const navigate = useNavigate()
  const { prefs, setPref } = usePrefs()
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (location.pathname === '/' && prefs.lastPath && prefs.lastPath !== '/') {
      navigate(prefs.lastPath, { replace: true })
    }
  }, [location.pathname, prefs.lastPath, navigate])

  useEffect(() => {
    if (restored.current) setPref('lastPath', location.pathname + location.search)
  }, [location.pathname, location.search, setPref])
}

export function AppShell({ children }: { children: ReactNode }) {
  const { scrollRef } = useUi()
  const location = useLocation()
  const [island, setIsland] = useState(false)
  const changingWindow = useRef(false)
  const previousWindow = useRef<{ size: PhysicalSize; position: PhysicalPosition; maximized: boolean; alwaysOnTop: boolean } | null>(null)
  async function changeIsland(on: boolean) {
    if (changingWindow.current) return
    changingWindow.current = true
    try {
      if (isDesktop) {
        const win = getCurrentWindow()
        if (on) {
          previousWindow.current = { size: await win.innerSize(), position: await win.outerPosition(), maximized: await win.isMaximized(), alwaysOnTop: await win.isAlwaysOnTop() }
          if (previousWindow.current.maximized) await win.unmaximize()
          await win.setMinSize(new LogicalSize(360, 100))
          await win.setSize(new LogicalSize(460, 116))
          await win.setAlwaysOnTop(true)
        } else {
          const old = previousWindow.current
          await win.setAlwaysOnTop(old?.alwaysOnTop ?? false)
          await win.setMinSize(new LogicalSize(880, 600))
          if (old) { await win.setSize(old.size); await win.setPosition(old.position); if (old.maximized) await win.maximize() }
        }
      }
      setIsland(on)
    } catch {
      if (isDesktop) {
        const win = getCurrentWindow()
        const old = previousWindow.current
        await win.setAlwaysOnTop(old?.alwaysOnTop ?? false).catch(() => undefined)
        await win.setMinSize(new LogicalSize(880, 600)).catch(() => undefined)
        if (old) { await win.setSize(old.size).catch(() => undefined); await win.setPosition(old.position).catch(() => undefined); if (old.maximized) await win.maximize().catch(() => undefined) }
      }
      setIsland(false)
      toast.error('Could not change mini-player mode')
    } finally { changingWindow.current = false }
  }
  useKeyboardShortcuts()
  useDocumentTitle()
  useRememberLastPath()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname, scrollRef])

  return (
    <>
      {isDesktop && <DesktopIntegration />}
      {island ? <IslandPlayer onExpand={() => void changeIsland(false)} /> : <>
      <AmbientBackground />
      {isDesktop && <TitleBar />}
      <div className={cn('relative z-10 flex h-screen flex-col gap-2.5 p-2.5 text-foreground', isDesktop && 'pt-8')}>
        <div className="relative flex min-h-0 flex-1 gap-2.5">
          <Sidebar />
          <main className="lc-glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[16px]">
            <div ref={scrollRef} className="lc-scroll relative flex-1 overflow-y-auto overflow-x-hidden [scroll-behavior:auto]">
              <TopBar />
              <div key={location.pathname} className="min-h-[calc(100%-3.5rem)]">
                {children}
              </div>
            </div>
          </main>
          <QueuePanel />
        </div>
        <MiniPlayer onIsland={() => void changeIsland(true)} />
      </div>
      <NowPlaying />
      <DropOverlay />
      </>}
      <Toaster
        position="bottom-right"
        offset={108}
        toastOptions={{
          classNames: {
            toast: 'lc-glass-menu !rounded-[14px] !border !text-foreground !shadow-none',
            title: '!text-[13px] !font-medium',
            description: '!text-xs !text-muted-foreground',
          },
        }}
      />
    </>
  )
}
