import { useEffect, useRef, useState } from 'react'
import { getArtworkUrl } from '../../core/artwork'
import { useCurrentTrack } from '../../state/PlayerContext'

/**
 * Static, artwork-derived ambience behind the glass panels. Crossfades between two layers on track
 * change — no continuous animation. Also publishes the track's accent color as CSS variables.
 */
export function AmbientBackground() {
  const track = useCurrentTrack()
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null])
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)

  const artworkId = track?.artworkId ?? null
  const accent = track?.accent ?? null

  useEffect(() => {
    let cancelled = false
    const apply = (url: string | null) => {
      if (cancelled) return
      const next = activeRef.current === 0 ? 1 : 0
      setSlots((s) => {
        const copy: [string | null, string | null] = [s[0], s[1]]
        copy[next] = url
        return copy
      })
      activeRef.current = next
      setActive(next)
    }
    if (artworkId) void getArtworkUrl(artworkId).then(apply)
    else apply(null)
    return () => {
      cancelled = true
    }
  }, [artworkId])

  useEffect(() => {
    const root = document.documentElement
    const h = accent ? accent[0] : 214
    const s = accent ? Math.max(22, Math.min(62, accent[1])) : 14
    root.style.setProperty('--accent-h', String(h))
    root.style.setProperty('--accent-s', `${s}%`)
  }, [accent])

  return (
    <div className="lc-ambient" aria-hidden>
      {slots.map((url, i) => (
        <div
          key={i}
          className="lc-ambient-layer"
          data-visible={i === active && !!url}
          style={url ? { backgroundImage: `url(${url})` } : undefined}
        />
      ))}
      <div className="lc-ambient-tint" />
    </div>
  )
}
