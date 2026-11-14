import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { formatLongDuration, plural } from '../core/format'
import type { Track } from '../core/types'
import { CollectionHeader, PageShell } from '../components/lucent/CollectionHeader'
import { EmptyLibrary } from '../components/lucent/EmptyLibrary'
import { TrackList } from '../components/lucent/TrackList'

export function FoldersPage() {
  const { folders, ready, pickFolder } = useLibrary()
  return (
    <PageShell>
      <header className="flex items-end justify-between gap-4 pb-7 pt-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Folders</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Songs grouped by the folder they were imported from</p>
        </div>
        <button
          type="button"
          onClick={pickFolder}
          className="lc-focus lc-glass flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.08)]"
        >
          <FolderPlus className="h-4 w-4" />
          Import folder
        </button>
      </header>
      {folders.length ? (
        <div className="lc-glass overflow-hidden rounded-[16px] p-1.5">
          {folders.map((f) => (
            <Link
              key={f.id}
              to={`/folders/${f.id}`}
              className="lc-focus lc-hover group flex items-center gap-4 rounded-[11px] px-3 py-2.5 transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--lc-hover)/0.06)]">
                <FolderIcon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{f.name}</div>
                <div className="truncate text-xs text-muted-foreground">{f.path || 'Individually imported files'}</div>
              </div>
              <span className="lc-tabular text-xs text-muted-foreground">
                {plural(f.trackIds.length, 'song')} · {formatLongDuration(f.duration)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      ) : ready ? (
        <EmptyLibrary />
      ) : null}
    </PageShell>
  )
}

export function FolderDetailPage() {
  const { folderId = '' } = useParams()
  const { foldersById, byId, ready } = useLibrary()
  const folder = foldersById.get(folderId)
  const tracks = useMemo(
    () => (folder ? folder.trackIds.map((id) => byId.get(id)).filter((t): t is Track => !!t) : []),
    [folder, byId],
  )

  if (!folder) {
    return (
      <PageShell className="py-24 text-center">
        {ready && (
          <>
            <p className="text-sm text-foreground">This folder is no longer in your library.</p>
            <Link to="/folders" className="lc-focus mt-2 inline-block rounded text-xs text-muted-foreground hover:text-foreground">
              Back to Folders
            </Link>
          </>
        )}
      </PageShell>
    )
  }

  const label = `Folder · ${folder.name}`
  return (
    <PageShell>
      <CollectionHeader
        kind="Folder"
        title={folder.name}
        subtitle={folder.path || 'Individually imported files'}
        meta={`${plural(tracks.length, 'song')} · ${formatLongDuration(folder.duration)}`}
        icon={<FolderOpen className="h-12 w-12 text-muted-foreground" strokeWidth={1.25} />}
        trackIds={folder.trackIds}
        contextLabel={label}
      />
      <TrackList tracks={tracks} contextLabel={label} />
    </PageShell>
  )
}
