import { useEffect, useRef, useState } from 'react'
import { Music2 } from 'lucide-react'
import { getArtworkUrl, peekArtworkUrl } from '../../core/artwork'
import { cn } from '../../lib/shadcn/utils'

interface ArtworkProps {
  artworkId: string | null
  className?: string
  iconClassName?: string
  /** Load immediately instead of waiting for the element to scroll into view */
  eager?: boolean
}

/** Cover art loaded lazily from local storage once it scrolls into view. */
export function Artwork({ artworkId, className, iconClassName, eager = false }: ArtworkProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(() => (artworkId ? (peekArtworkUrl(artworkId) ?? null) : null))
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!artworkId) {
      setUrl(null)
      return
    }
    const cached = peekArtworkUrl(artworkId)
    if (cached !== undefined) {
      setUrl(cached)
      return
    }
    let cancelled = false
    const load = () =>
      void getArtworkUrl(artworkId).then((u) => {
        if (!cancelled) setUrl(u)
      })
    if (eager || !ref.current || typeof IntersectionObserver === 'undefined') {
      load()
      return () => {
        cancelled = true
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(ref.current)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [artworkId, eager])

  return (
    <div ref={ref} className={cn('lc-art shrink-0', className)}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          data-loaded={loaded}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Music2 className={cn('h-1/3 w-1/3 max-h-10 max-w-10 text-muted-foreground/60', iconClassName)} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
