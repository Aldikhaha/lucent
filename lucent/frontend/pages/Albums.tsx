import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLibrary } from '../state/LibraryContext'
import { formatLongDuration, plural } from '../core/format'
import type { Track } from '../core/types'
import { AlbumCard } from '../components/lucent/AlbumCard'
import { CollectionHeader, PageShell } from '../components/lucent/CollectionHeader'
import { EmptyLibrary } from '../components/lucent/EmptyLibrary'
import { TrackList } from '../components/lucent/TrackList'

export function AlbumsPage() {
  const { albums, ready } = useLibrary()
  return (
    <PageShell>
      <header className="pb-7 pt-4">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Albums</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{plural(albums.length, 'album')}</p>
      </header>
      {albums.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-7">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      ) : ready ? (
        <EmptyLibrary />
      ) : null}
    </PageShell>
  )
}

export function AlbumDetailPage() {
  const { albumId = '' } = useParams()
  const { albumsById, byId, ready } = useLibrary()
  const album = albumsById.get(albumId)
  const tracks = useMemo(
    () => (album ? album.trackIds.map((id) => byId.get(id)).filter((t): t is Track => !!t) : []),
    [album, byId],
  )

  if (!album) {
    return (
      <PageShell className="py-24 text-center">
        {ready && (
          <>
            <p className="text-sm text-foreground">This album is no longer in your library.</p>
            <Link to="/albums" className="lc-focus mt-2 inline-block rounded text-xs text-muted-foreground hover:text-foreground">
              Back to Albums
            </Link>
          </>
        )}
      </PageShell>
    )
  }

  const label = `Album · ${album.title}`
  return (
    <PageShell>
      <CollectionHeader
        kind="Album"
        title={album.title}
        subtitle={album.artist}
        meta={[album.year, plural(tracks.length, 'song'), formatLongDuration(album.duration)].filter(Boolean).join(' · ')}
        artworkId={album.artworkId}
        trackIds={album.trackIds}
        contextLabel={label}
      />
      <TrackList tracks={tracks} contextLabel={label} variant="album" />
    </PageShell>
  )
}
