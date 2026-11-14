import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, FilePlus2, FolderPlus, Loader2, Plus, Search, X } from 'lucide-react'
import { useLibrary } from '../../state/LibraryContext'
import { useUi } from '../../state/UiContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../../lib/shadcn/dropdown-menu'
import { IconButton } from './IconButton'
import { menuContentClass, menuItemClass } from './trackMenu'

function ImportProgressPill() {
  const { progress } = useLibrary()
  if (!progress) return null
  const pct = progress.total ? (progress.processed / progress.total) * 100 : 0
  return (
    <div
      role="status"
      aria-live="polite"
      className="lc-glass flex h-8 items-center gap-2.5 rounded-full px-3 text-xs text-foreground duration-200 animate-in fade-in-0"
      title={progress.current}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      <span className="lc-tabular">
        Importing {progress.processed.toLocaleString()} of {progress.total.toLocaleString()}
      </span>
      <span className="lc-bar w-16">
        <span className="lc-bar-fill" style={{ transform: `scaleX(${pct / 100})`, background: 'var(--lc-accent)' }} />
      </span>
    </div>
  )
}

export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { searchInputRef } = useUi()
  const { pickFiles, pickFolder } = useLibrary()
  const isSearch = location.pathname === '/search'
  const q = isSearch ? (new URLSearchParams(location.search).get('q') ?? '') : ''
  const [value, setValue] = useState(q)
  const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0

  useEffect(() => setValue(q), [q])

  const onChange = (v: string) => {
    setValue(v)
    navigate(v ? `/search?q=${encodeURIComponent(v)}` : '/search', { replace: isSearch })
  }

  return (
    <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 bg-[hsl(var(--lc-glass)/0.18)] px-5 backdrop-blur-xl">
      <IconButton label="Back" size="sm" tooltipSide="bottom" disabled={historyIdx <= 0} onClick={() => navigate(-1)}>
        <ChevronLeft />
      </IconButton>

      <label className="lc-glass group relative flex h-9 w-full max-w-[380px] items-center gap-2 rounded-full px-3.5 transition-shadow focus-within:shadow-[0_0_0_2px_var(--lc-accent-soft)]">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !isSearch && navigate('/search')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (value) onChange('')
              else e.currentTarget.blur()
            }
          }}
          placeholder="Search songs, artists, albums"
          aria-label="Search library"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="lc-focus flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded px-1 font-sans text-[10px] text-muted-foreground/70 sm:block">Ctrl K</kbd>
        )}
      </label>

      <div className="ml-auto flex items-center gap-2">
        <ImportProgressPill />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="lc-focus lc-glass flex h-9 items-center gap-2 rounded-full pl-3 pr-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.08)]"
            >
              <Plus className="h-4 w-4" />
              Import
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuContentClass}>
            <DropdownMenuItem className={menuItemClass} onSelect={pickFolder}>
              <FolderPlus className="h-4 w-4" />
              Import folder…
              <DropdownMenuShortcut>Ctrl ⇧ O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItemClass} onSelect={pickFiles}>
              <FilePlus2 className="h-4 w-4" />
              Import files…
              <DropdownMenuShortcut>Ctrl O</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
