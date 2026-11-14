import { Disc3, FolderOpen, FolderSearch, ListEnd, ListStart, Pause, Play, Trash2, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Track } from '../../core/types'
import { isDesktop } from '../../core/platform'
import { revealInExplorer } from '../../core/platform/desktop'
import { albumKey, folderKey } from '../../state/LibraryContext'
import { useTrackActions } from '../../state/PlayerContext'

export interface TrackMenuAction {
  key: string
  label: string
  icon: LucideIcon
  run: () => void
  destructive?: boolean
  separatorBefore?: boolean
}

/** Builds the action list shared by the right-click context menu and the "more" dropdown. */
export function useTrackMenuActions(
  track: Track,
  opts: { isCurrent: boolean; isPlaying: boolean; onPlay: () => void; onRemove: () => void },
): TrackMenuAction[] {
  const navigate = useNavigate()
  const { playNext, addToQueue } = useTrackActions()
  const reveal: TrackMenuAction[] =
    isDesktop && track.path
      ? [
          {
            key: 'reveal',
            label: 'Show in File Explorer',
            icon: FolderSearch,
            run: () => {
              revealInExplorer(track.path!).catch(() =>
                toast.error("Couldn't open File Explorer", { description: 'The file may have been moved or deleted.' }),
              )
            },
          },
        ]
      : []
  return [
    {
      key: 'play',
      label: opts.isCurrent && opts.isPlaying ? 'Pause' : 'Play',
      icon: opts.isCurrent && opts.isPlaying ? Pause : Play,
      run: opts.onPlay,
    },
    { key: 'next', label: 'Play next', icon: ListStart, run: () => playNext([track.id]) },
    { key: 'queue', label: 'Add to queue', icon: ListEnd, run: () => addToQueue([track.id]) },
    {
      key: 'album',
      label: 'Go to album',
      icon: Disc3,
      run: () => navigate(`/albums/${albumKey(track)}`),
      separatorBefore: true,
    },
    { key: 'folder', label: 'Go to folder', icon: FolderOpen, run: () => navigate(`/folders/${folderKey(track.folder)}`) },
    ...reveal,
    {
      key: 'remove',
      label: 'Remove from library',
      icon: Trash2,
      run: opts.onRemove,
      destructive: true,
      separatorBefore: true,
    },
  ]
}

export const menuContentClass = 'lc-glass-menu min-w-[200px] rounded-xl border p-1'
export const menuItemClass = 'gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] focus:bg-[hsl(var(--lc-hover)/0.08)]'
export const menuDestructiveClass = 'text-destructive focus:text-destructive'
