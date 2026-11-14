import { NavLink, useNavigate } from 'react-router-dom'
import { Clock, Disc3, FolderTree, Home, ListMusic, Music, PanelLeftClose, PanelLeftOpen, Search, Settings, type LucideIcon } from 'lucide-react'
import { usePrefs } from '../../state/PrefsContext'
import { usePlaylists } from '../../state/PlaylistContext'
import { useUi } from '../../state/UiContext'
import { useLibrary } from '../../state/LibraryContext'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../lib/shadcn/tooltip'
import { cn } from '../../lib/shadcn/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  count?: number
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'lc-focus group relative flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13px] transition-colors duration-150',
          isActive ? 'lc-active font-medium text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--lc-hover)/0.05)] hover:text-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="lc-accent-bg absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full" />}
          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'lc-accent-text')} strokeWidth={1.75} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && item.count !== undefined && item.count > 0 && (
            <span className="lc-tabular text-[11px] text-muted-foreground/70">{item.count.toLocaleString()}</span>
          )}
        </>
      )}
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="lc-glass-menu border-0 px-2.5 py-1 text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const { prefs, setPref } = usePrefs()
  const { searchInputRef } = useUi()
  const { tracks, albums, folders } = useLibrary()
  const { playlists } = usePlaylists()
  const navigate = useNavigate()
  const collapsed = prefs.sidebarCollapsed

  const library: NavItem[] = [
    { to: '/playlists', label: 'Playlists', icon: ListMusic, count: playlists.length },
    { to: '/songs', label: 'Songs', icon: Music, count: tracks.length },
    { to: '/albums', label: 'Albums', icon: Disc3, count: albums.length },
    { to: '/folders', label: 'Folders', icon: FolderTree, count: folders.length },
    { to: '/recent', label: 'Recently Played', icon: Clock },
  ]

  const SearchButton = (
    <button
      type="button"
      onClick={() => {
        navigate('/search')
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }}
      className={cn(
        'lc-focus flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.05)] hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Search</span>
          <kbd className="lc-hairline rounded border px-1 font-sans text-[10px] text-muted-foreground/80">Ctrl K</kbd>
        </>
      )}
    </button>
  )

  return (
    <nav
      aria-label="Main"
      className={cn(
        'lc-glass flex shrink-0 flex-col rounded-[16px] py-4 transition-[width] duration-300 [transition-timing-function:var(--ease-glass)]',
        collapsed ? 'w-[60px] px-2' : 'w-[224px] px-3',
      )}
    >
      <div className={cn('mb-6 flex items-center gap-2.5 px-2', collapsed && 'justify-center px-0')}>
        <div
          aria-hidden
          className="relative h-6 w-6 shrink-0 rounded-full shadow-[inset_0_1px_1px_hsl(0_0%_100%/0.5),0_2px_8px_-2px_hsl(var(--lc-shadow)/0.5)]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, hsl(0 0% 100% / 0.9), hsl(var(--accent-h) var(--accent-s) 70% / 0.9) 45%, hsl(var(--accent-h) var(--accent-s) 30%) 100%)',
          }}
        />
        {!collapsed && <span className="lc-wordmark text-[13px] font-semibold text-foreground">LUCENT</span>}
      </div>

      <div className="flex flex-col gap-0.5">
        <SidebarLink item={{ to: '/', label: 'Home', icon: Home }} collapsed={collapsed} />
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{SearchButton}</TooltipTrigger>
            <TooltipContent side="right" className="lc-glass-menu border-0 px-2.5 py-1 text-xs">
              Search
            </TooltipContent>
          </Tooltip>
        ) : (
          SearchButton
        )}
      </div>

      <div className="mt-6 flex flex-col gap-0.5">
        {!collapsed && (
          <div className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Your Library</div>
        )}
        {library.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <SidebarLink item={{ to: '/settings', label: 'Settings', icon: Settings }} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setPref('sidebarCollapsed', !collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'lc-focus flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.05)] hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          {!collapsed && <span className="flex-1 text-left">Collapse</span>}
          {!collapsed && <kbd className="lc-hairline rounded border px-1 font-sans text-[10px] text-muted-foreground/80">Ctrl B</kbd>}
        </button>
      </div>
    </nav>
  )
}
