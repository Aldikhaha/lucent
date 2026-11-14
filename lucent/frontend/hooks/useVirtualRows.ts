import { useLayoutEffect, useState, type RefObject } from 'react'
import { useUi } from '../state/UiContext'

/**
 * Fixed-height list virtualization against the app's main scroll container.
 * Only rows inside the viewport (plus overscan) are rendered.
 */
export function useVirtualRows(listRef: RefObject<HTMLElement | null>, count: number, rowHeight: number, overscan = 8) {
  const { scrollRef } = useUi()
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 30) })

  useLayoutEffect(() => {
    const el = scrollRef.current
    const list = listRef.current
    if (!el || !list) return
    let raf = 0
    const compute = () => {
      raf = 0
      const listTop = list.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
      const viewTop = el.scrollTop - listTop
      const start = Math.max(0, Math.floor(viewTop / rowHeight) - overscan)
      const end = Math.min(count, Math.ceil((viewTop + el.clientHeight) / rowHeight) + overscan)
      setRange((r) => (r.start === start && r.end === end ? r : { start, end: Math.max(start, end) }))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    compute()
    el.addEventListener('scroll', schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollRef, listRef, count, rowHeight, overscan])

  return range
}
