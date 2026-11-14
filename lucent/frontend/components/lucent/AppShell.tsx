import { useEffect, useRef, type ReactNode } from 'react'
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
  useKeyboardShortcuts()
  useDocumentTitle()
  useRememberLastPath()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname, scrollRef])

  return (
    <>
      <AmbientBackground />
      {isDesktop && <TitleBar />}
      {isDesktop && <DesktopIntegration />}
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
        <MiniPlayer />
      </div>
      <NowPlaying />
      <DropOverlay />
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
