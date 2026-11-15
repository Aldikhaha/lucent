import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatLongDuration, formatTime, plural } from '../core/format'
import type { Track } from '../core/types'
import { useLibrary } from '../state/LibraryContext'
import { usePlaylists } from '../state/PlaylistContext'
import { usePlayer, usePlayerState } from '../state/PlayerContext'
import { Artwork } from '../components/lucent/Artwork'
import { PlaylistCover } from '../components/lucent/PlaylistCover'
import { CollectionHeader, PageShell } from '../components/lucent/CollectionHeader'
import { ConfirmDialog } from '../components/lucent/ConfirmDialog'
import { cn } from '../lib/shadcn/utils'

const inputClass =
  'lc-focus lc-glass h-10 min-w-0 rounded-xl px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground'
const buttonClass =
  'lc-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40'
const smallButton =
  'lc-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.1)] hover:text-foreground disabled:opacity-25'

export function PlaylistsPage() {
  const { playlists, create, addTrack } = usePlaylists()
  const { byId } = useLibrary()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const selected = byId.get(params.get('add') ?? '')

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const id = create(name, selected?.id)
    if (!id) {
      setError('Enter a name that is not already in use.')
      return
    }
    setName('')
    setError('')
    if (selected) toast.success(`Added to ${name.trim()}`)
    navigate(`/playlists/${id}`)
  }
  function handleAdd(id: string) {
    if (!selected) return
    if (addTrack(id, selected.id)) toast.success('Added to playlist')
    else toast('This song is already in the playlist')
    navigate(`/playlists/${id}`)
  }

  return (
    <PageShell>
      <header className="pb-6 pt-4">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Playlists</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Your music, your order. Saved on this device.</p>
      </header>
      <Link to="/spotify" className="lc-focus mb-5 inline-flex rounded-xl bg-[hsl(var(--lc-hover)/0.08)] px-4 py-2 text-sm hover:bg-[hsl(var(--lc-hover)/0.14)]">Listen with Spotify · Experimental</Link>
      {selected && (
        <div
          role="status"
          className="lc-glass mb-5 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
        >
          <span className="min-w-0 truncate">
            Choose a playlist for <strong>{selected.title}</strong>, or create a new one.
          </span>
          <Link to="/playlists" aria-label="Cancel adding to playlist" className={smallButton}>
            <X className="h-4 w-4" />
          </Link>
        </div>
      )}
      <form onSubmit={handleCreate} className="mb-8 flex max-w-lg flex-wrap items-start gap-2">
        <div className="min-w-[180px] flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            maxLength={100}
            aria-label="New playlist name"
            placeholder="Name your playlist"
            className={`${inputClass} w-full`}
          />
          {error && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <button className={buttonClass} type="submit">
          <Plus className="h-4 w-4" /> Create playlist
        </button>
      </form>
      {playlists.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {playlists.map((p) => (
            <div key={p.id} className="lc-playlist-card lc-glass flex flex-col rounded-2xl p-4">
              <Link to={`/playlists/${p.id}`} className="lc-focus flex min-w-0 items-center gap-3 rounded-lg text-left">
                <PlaylistCover id={p.id} revision={p.coverRevision} className="h-12 w-12 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {plural(p.trackIds.filter((id) => byId.has(id)).length, 'song')}
                  </span>
                </span>
              </Link>
              {selected && (
                <button
                  type="button"
                  onClick={() => handleAdd(p.id)}
                  className="lc-focus mt-4 rounded-lg bg-[hsl(var(--lc-hover)/0.07)] px-3 py-2 text-xs font-medium hover:bg-[hsl(var(--lc-hover)/0.12)]"
                >
                  Add song
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-sm text-muted-foreground">
          No playlists yet. Create one above, then add songs from their menu.
        </p>
      )}
    </PageShell>
  )
}

export function PlaylistDetailPage() {
  const { playlistId = '' } = useParams()
  const { playlists, rename, remove, addTrack, removeTrack, moveTrack, setCover } = usePlaylists()
  const { byId, tracks: libraryTracks } = useLibrary()
  const engine = usePlayer()
  const player = usePlayerState()
  const navigate = useNavigate()
  const playlist = playlists.find((p) => p.id === playlistId)
  const tracks = useMemo(
    () => (playlist?.trackIds ?? []).map((id) => byId.get(id)).filter((t): t is Track => !!t),
    [playlist, byId],
  )
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  if (!playlist)
    return (
      <PageShell className="py-24 text-center">
        <p className="text-sm">This playlist could not be found.</p>
        <Link className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground" to="/playlists">
          Back to playlists
        </Link>
      </PageShell>
    )
  const ids = tracks.map((t) => t.id)
  const label = `Playlist · ${playlist.name}`
  const duration = tracks.reduce((sum, t) => sum + t.duration, 0)
  const matches = libraryTracks.filter((t) =>
    `${t.title} ${t.artist} ${t.album}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  function saveName(e: FormEvent) {
    e.preventDefault()
    if (!rename(playlistId, name)) {
      setError('Enter a name that is not already in use.')
      return
    }
    setEditing(false)
    setError('')
  }
  return (
    <PageShell>
      <CollectionHeader
        kind="Playlist"
        title={playlist.name}
        meta={`${plural(tracks.length, 'song')} · ${formatLongDuration(duration)}`}
        icon={<PlaylistCover id={playlist.id} revision={playlist.coverRevision} className="h-full w-full rounded-[18px]" />}
        trackIds={ids}
        contextLabel={label}
        actions={
          <>
            <button
              type="button"
              aria-expanded={adding}
              onClick={() => setAdding(!adding)}
              className="lc-focus rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {adding ? 'Done adding' : 'Add songs'}
            </button>
            <label className="lc-focus cursor-pointer rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
              Change cover
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Choose playlist cover" className="sr-only" onChange={(e) => {
                const file = e.target.files?.[0]; e.target.value = ''
                if (file) void setCover(playlistId, file).then(() => toast.success('Playlist cover saved')).catch((err) => toast.error(err instanceof Error ? err.message : 'Could not save cover'))
              }} />
            </label>
            {playlist.coverRevision > 0 && <button type="button" onClick={() => void setCover(playlistId, null).catch(() => toast.error('Could not remove cover'))} className="lc-focus rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Remove cover</button>}
            <button
              type="button"
              onClick={() => {
                setName(playlist.name)
                setEditing(true)
                setError('')
              }}
              className="lc-focus rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="lc-focus rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Delete
            </button>
          </>
        }
      />
      {editing && (
        <form onSubmit={saveName} className="mb-6 flex max-w-lg flex-wrap items-start gap-2">
          <div className="min-w-[180px] flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              aria-label="Playlist name"
              maxLength={100}
              className={`${inputClass} w-full`}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className={buttonClass}>
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="lc-focus h-10 rounded-xl px-3 text-sm text-muted-foreground"
          >
            Cancel
          </button>
        </form>
      )}
      {adding && (
        <section aria-label="Add songs to playlist" className="lc-glass mb-6 rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Add from your library</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search songs to add"
              placeholder="Search songs or artists"
              className={`${inputClass} w-full sm:w-64`}
            />
          </div>
          <div className="lc-scroll max-h-64 overflow-y-auto">
            {matches.slice(0, 100).map((t) => {
              const added = playlist.trackIds.includes(t.id)
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.title} <span className="text-muted-foreground">· {t.artist}</span>
                  </span>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addTrack(playlistId, t.id)}
                    aria-label={added ? `${t.title} already added` : `Add ${t.title} to playlist`}
                    className="lc-focus rounded-lg px-3 py-1.5 text-xs hover:bg-[hsl(var(--lc-hover)/0.08)] disabled:opacity-40"
                  >
                    {added ? 'Added' : 'Add'}
                  </button>
                </div>
              )
            })}
            {!matches.length && (
              <p className="py-3 text-xs text-muted-foreground">
                {libraryTracks.length ? 'No songs match your search.' : 'Import songs to your library first.'}
              </p>
            )}
          </div>
          {matches.length > 100 && (
            <p className="mt-2 text-xs text-muted-foreground">Showing up to 100 matches. Search to find more.</p>
          )}
        </section>
      )}
      {tracks.length > 0 && <p className="mb-3 text-xs text-muted-foreground">Saved playlist order. Playback uses a separate queue; play the playlist again to refresh it after editing.</p>}
      {tracks.length ? (
        <div className="flex flex-col gap-1" aria-label="Playlist songs">
          {tracks.map((t, i) => (
            <div key={t.id} className="lc-playlist-row lc-hover group flex items-center gap-3 rounded-xl px-2 py-2">
              <button
                type="button"
                onClick={() => engine.playQueue(ids, i, label, false)}
                aria-label={`Play ${t.title}`}
                className="lc-focus flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
              >
                <span className="lc-tabular w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                <Artwork artworkId={t.artworkId} className="h-10 w-10 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      player.queue[player.index] === t.id && 'lc-accent-text',
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
                </span>
                <span className="lc-tabular hidden text-xs text-muted-foreground sm:block">
                  {formatTime(t.duration)}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Move ${t.title} up`}
                disabled={i === 0}
                onClick={() => moveTrack(playlistId, t.id, -1)}
                className={smallButton}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${t.title} down`}
                disabled={i === tracks.length - 1}
                onClick={() => moveTrack(playlistId, t.id, 1)}
                className={smallButton}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${t.title} from playlist`}
                onClick={() => removeTrack(playlistId, t.id)}
                className={smallButton}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-sm text-muted-foreground">
          This playlist is empty. Open a song’s menu and choose “Add to playlist”.
        </p>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete playlist?"
        description={`“${playlist.name}” will be deleted. Your songs and original files will not be affected.`}
        confirmLabel="Delete playlist"
        onConfirm={() => {
          remove(playlistId)
          navigate('/playlists')
          toast('Playlist deleted')
        }}
      />
    </PageShell>
  )
}
