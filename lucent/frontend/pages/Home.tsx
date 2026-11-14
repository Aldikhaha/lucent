import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { formatLongDuration, plural } from '../core/format'
import type { Track } from '../core/types'
import { PageShell } from '../components/lucent/CollectionHeader'
import { EmptyLibrary } from '../components/lucent/EmptyLibrary'
import { AlbumCard } from '../components/lucent/AlbumCard'
import { Artwork } from '../components/lucent/Artwork'
import { Skeleton } from '../lib/shadcn/skeleton'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function SectionTitle({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
      {to && (
        <Link to={to} className="lc-focus rounded text-xs text-muted-foreground transition-colors hover:text-foreground">
          See all
        </Link>
      )}
    </div>
  )
}

function RecentTile({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="lc-focus lc-glass group flex min-w-0 items-center gap-3 rounded-[14px] p-2 pr-3 text-left transition-colors hover:bg-[hsl(var(--lc-hover)/0.06)]"
    >
      <div className="relative">
        <Artwork artworkId={track.artworkId} className="h-12 w-12 rounded-[10px]" />
        <span className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-4 w-4 fill-white text-white" />
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-foreground">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
      </div>
    </button>
  )
}

export default function Home() {
  const { ready, tracks, albums } = useLibrary()
  const engine = usePlayer()

  const recent = useMemo(
    () =>
      tracks
        .filter((t) => t.lastPlayedAt)
        .sort((a, b) => b.lastPlayedAt! - a.lastPlayedAt!)
        .slice(0, 6),
    [tracks],
  )
  const recentlyAdded = useMemo(() => albums.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 12), [albums])
  const totalDuration = useMemo(() => tracks.reduce((s, t) => s + t.duration, 0), [tracks])

  if (!ready) {
    return (
      <PageShell>
        <Skeleton className="mt-6 h-9 w-64 rounded-lg bg-[hsl(var(--lc-hover)/0.06)]" />
        <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-[14px] bg-[hsl(var(--lc-hover)/0.06)]" />
          ))}
        </div>
      </PageShell>
    )
  }

  if (!tracks.length) {
    return (
      <PageShell className="flex min-h-full flex-col justify-center py-10">
        <EmptyLibrary />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-4 pb-9 pt-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">{greeting()}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {plural(tracks.length, 'song')} · {plural(albums.length, 'album')} · {formatLongDuration(totalDuration)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => engine.playQueue(tracks.map((t) => t.id), 0, 'Library', true)}
          className="lc-focus flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Shuffle className="h-4 w-4" />
          Shuffle library
        </button>
      </header>

      {recent.length > 0 && (
        <section className="mb-11">
          <SectionTitle title="Jump back in" to="/recent" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {recent.map((t, i) => (
              <RecentTile key={t.id} track={t} onPlay={() => engine.playQueue(recent.map((r) => r.id), i, 'Recently Played')} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Recently added" to="/albums" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-7">
          {recentlyAdded.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      </section>
    </PageShell>
  )
}
