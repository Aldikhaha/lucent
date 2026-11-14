import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type MotionPref = 'system' | 'full' | 'minimal'
export type SongSort = 'title' | 'artist' | 'album' | 'added' | 'duration'

export interface Prefs {
  /** 0 (solid) – 100 (most transparent) */
  transparency: number
  /** Backdrop blur in px */
  blur: number
  motion: MotionPref
  /** Decorative particles in the full-screen player. */
  nowPlayingEffects: boolean
  compact: boolean
  sidebarCollapsed: boolean
  songSort: SongSort
  songSortDesc: boolean
  lastPath: string
  /** Desktop: closing the window keeps Lucent playing in the system tray */
  closeToTray: boolean
  /** Desktop: react to keyboard media keys even when Lucent isn't focused */
  mediaKeys: boolean
}

export const DEFAULT_PREFS: Prefs = {
  transparency: 55,
  blur: 28,
  motion: 'system',
  nowPlayingEffects: true,
  compact: false,
  sidebarCollapsed: false,
  songSort: 'added',
  songSortDesc: true,
  lastPath: '/',
  closeToTray: false,
  mediaKeys: true,
}

const STORAGE_KEY = 'lucent.prefs.v1'

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

interface PrefsContextValue {
  prefs: Prefs
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  resetPrefs: () => void
  reducedMotion: boolean
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setSystemReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [prefs])

  const reducedMotion = prefs.motion === 'minimal' || (prefs.motion === 'system' && systemReduced)

  // Apply visual preferences as CSS variables on the root element.
  useEffect(() => {
    const root = document.documentElement
    const alpha = 0.92 - (prefs.transparency / 100) * 0.72
    root.style.setProperty('--glass-alpha', alpha.toFixed(3))
    root.style.setProperty('--glass-blur', `${prefs.blur}px`)
    root.classList.toggle('lc-reduce-motion', reducedMotion)
    root.classList.toggle('lc-compact', prefs.compact)
  }, [prefs.transparency, prefs.blur, prefs.compact, reducedMotion])

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => (p[key] === value ? p : { ...p, [key]: value }))
  }, [])

  const resetPrefs = useCallback(
    () =>
      setPrefs((p) => ({ ...DEFAULT_PREFS, lastPath: p.lastPath, closeToTray: p.closeToTray, mediaKeys: p.mediaKeys })),
    [],
  )

  const value = useMemo(() => ({ prefs, setPref, resetPrefs, reducedMotion }), [prefs, setPref, resetPrefs, reducedMotion])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider')
  return ctx
}
