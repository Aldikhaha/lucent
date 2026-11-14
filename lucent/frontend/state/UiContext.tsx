import { createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

interface UiContextValue {
  nowPlayingOpen: boolean
  setNowPlayingOpen: (open: boolean) => void
  queueOpen: boolean
  setQueueOpen: (open: boolean) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
}

const UiContext = createContext<UiContextValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const value = useMemo(
    () => ({ nowPlayingOpen, setNowPlayingOpen, queueOpen, setQueueOpen, searchInputRef, scrollRef }),
    [nowPlayingOpen, queueOpen],
  )
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
