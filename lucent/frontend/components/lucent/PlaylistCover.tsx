import { useEffect, useState } from 'react'
import { ListMusic } from 'lucide-react'
import { getPlaylistCover } from '../../core/playlistCovers'
import { cn } from '../../lib/shadcn/utils'

export function PlaylistCover({ id, revision, className }: { id: string; revision: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    setUrl(null)
    if (revision) void getPlaylistCover(id).then((blob) => {
      if (!cancelled && blob) { created = URL.createObjectURL(blob); setUrl(created) }
    }).catch(() => undefined)
    return () => { cancelled = true; if (created) URL.revokeObjectURL(created) }
  }, [id, revision])
  return <span className={cn('lc-playlist-icon relative flex shrink-0 items-center justify-center overflow-hidden', className)}>
    {url ? <img className="h-full w-full object-cover" src={url} alt="" /> : <ListMusic className="h-1/3 w-1/3" />}
  </span>
}
