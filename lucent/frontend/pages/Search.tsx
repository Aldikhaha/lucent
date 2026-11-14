import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { plural } from '../core/format'
import { PageShell } from '../components/lucent/CollectionHeader'
import { AlbumCard } from '../components/lucent/AlbumCard'
import { TrackList } from '../components/lucent/TrackList'

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function Search() {
  const location = useLocation()
  const q = new URLSearchParams(location.search).get('q')?.trim() ?? ''
  const { tracks, albums } = useLibrary()

  const { songs, albumHits } = useMemo(() => {
    if (!q) return { songs: [], albumHits: [] }
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    const matches = (hay: string) => {
      const h = normalize(hay)
      return terms.every((t) => h.includes(t))
    }
    return {
      songs: tracks.filter((t) => matches(`${t.title} ${t.artist} ${t.album} ${t.fileName}`)),
      albumHits: albums.filter((a) => matches(`${a.title} ${a.artist}`)).slice(0, 12),
    }
  }, [q, tracks, albums])

  return (
    <PageShell>
      <header className="pb-7 pt-4">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Search</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {q ? `${plural(songs.length, 'song')} and ${plural(albumHits.length, 'album')} for “${q}”` : 'Find anything in your library'}
        </p>
      </header>

      {!q && (
        <div className="flex flex-col items-center py-20 text-center">
          <SearchIcon className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">Type a song title, artist or album.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Press Ctrl K from anywhere to jump here.</p>
        </div>
      )}

      {q && !songs.length && !albumHits.length && (
        <div className="lc-glass rounded-[16px] px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No results</p>
          <p className="mt-1 text-xs text-muted-foreground">Try fewer words or check the spelling.</p>
        </div>
      )}

      {albumHits.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-[17px] font-semibold tracking-tight text-foreground">Albums</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">
            {albumHits.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section>
          <h2 className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">Songs</h2>
          <TrackList tracks={songs} contextLabel={`Search · ${q}`} />
        </section>
      )}
    </PageShell>
  )
}
