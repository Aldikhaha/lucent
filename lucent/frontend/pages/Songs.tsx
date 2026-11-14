import { useMemo } from 'react'
import { ArrowDownUp, Music } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePrefs, type SongSort } from '../state/PrefsContext'
import { formatLongDuration, plural } from '../core/format'
import type { Track } from '../core/types'
import { CollectionHeader, PageShell } from '../components/lucent/CollectionHeader'
import { TrackList } from '../components/lucent/TrackList'
import { EmptyLibrary } from '../components/lucent/EmptyLibrary'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../lib/shadcn/dropdown-menu'
import { menuContentClass, menuItemClass } from '../components/lucent/trackMenu'

const SORTS: { value: SongSort; label: string }[] = [
  { value: 'added', label: 'Date added' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'duration', label: 'Duration' },
]

const compare: Record<SongSort, (a: Track, b: Track) => number> = {
  added: (a, b) => a.addedAt - b.addedAt,
  title: (a, b) => a.title.localeCompare(b.title),
  artist: (a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0),
  album: (a, b) => a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0),
  duration: (a, b) => a.duration - b.duration,
}

export default function Songs() {
  const { tracks, ready } = useLibrary()
  const { prefs, setPref } = usePrefs()

  const sorted = useMemo(() => {
    const cmp = compare[prefs.songSort]
    const list = tracks.slice().sort(cmp)
    return prefs.songSortDesc ? list.reverse() : list
  }, [tracks, prefs.songSort, prefs.songSortDesc])

  const total = useMemo(() => tracks.reduce((s, t) => s + t.duration, 0), [tracks])
  const sortLabel = SORTS.find((s) => s.value === prefs.songSort)?.label ?? ''

  return (
    <PageShell>
      <CollectionHeader
        kind="Library"
        title="Songs"
        meta={`${plural(tracks.length, 'song')} · ${formatLongDuration(total)}`}
        icon={<Music className="h-12 w-12 text-muted-foreground" strokeWidth={1.25} />}
        trackIds={sorted.map((t) => t.id)}
        contextLabel="Songs"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="lc-focus ml-auto flex h-9 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.06)] hover:text-foreground"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                {sortLabel}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={menuContentClass}>
              <DropdownMenuRadioGroup value={prefs.songSort} onValueChange={(v) => setPref('songSort', v as SongSort)}>
                {SORTS.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value} className={`${menuItemClass} pl-8`}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="mx-1 my-1 bg-[hsl(var(--lc-stroke)/0.08)]" />
              <DropdownMenuRadioGroup
                value={prefs.songSortDesc ? 'desc' : 'asc'}
                onValueChange={(v) => setPref('songSortDesc', v === 'desc')}
              >
                <DropdownMenuRadioItem value="asc" className={`${menuItemClass} pl-8`}>
                  Ascending
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc" className={`${menuItemClass} pl-8`}>
                  Descending
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <TrackList tracks={sorted} contextLabel="Songs" empty={ready ? <EmptyLibrary compact /> : null} />
    </PageShell>
  )
}
