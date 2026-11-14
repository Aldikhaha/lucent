import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { usePlayer, usePlayerState } from '../../state/PlayerContext'
import { formatTime } from '../../core/format'
import { cn } from '../../lib/shadcn/utils'

interface SeekBarProps {
  className?: string
  timeClassName?: string
  showTimes?: boolean
}

/**
 * Playback progress. While playing it paints via requestAnimationFrame straight to the DOM
 * (no React re-renders); when paused it only repaints on actual time changes.
 */
export function SeekBar({ className, timeClassName, showTimes = true }: SeekBarProps) {
  const engine = usePlayer()
  const { duration, status, index } = usePlayerState()
  const barRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef<HTMLSpanElement>(null)
  const [dragFrac, setDragFrac] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const disabled = index < 0 || !duration

  const paint = useCallback(
    (t: number) => {
      const frac = duration ? Math.min(1, Math.max(0, t / duration)) : 0
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`
      if (thumbRef.current) thumbRef.current.style.left = `${frac * 100}%`
      if (elapsedRef.current) elapsedRef.current.textContent = formatTime(t)
      barRef.current?.setAttribute('aria-valuenow', String(Math.round(t)))
      barRef.current?.setAttribute('aria-valuetext', `${formatTime(t)} of ${formatTime(duration)}`)
    },
    [duration],
  )

  useEffect(() => {
    if (dragFrac !== null) return
    paint(engine.getTime())
    if (status === 'playing') {
      let raf = 0
      const loop = () => {
        paint(engine.audio.currentTime)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    }
    return engine.subscribeTime(() => paint(engine.getTime()))
  }, [engine, status, paint, dragFrac])

  const fracFromEvent = (e: PointerEvent) => {
    const rect = barRef.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const f = fracFromEvent(e)
    dragRef.current = f
    setDragFrac(f)
    paint(f * duration)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null) return
    const f = fracFromEvent(e)
    dragRef.current = f
    paint(f * duration)
  }

  const onPointerUp = () => {
    if (dragRef.current === null) return
    engine.seek(dragRef.current * duration)
    dragRef.current = null
    setDragFrac(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    const keys: Record<string, () => void> = {
      ArrowLeft: () => engine.seekBy(-5),
      ArrowRight: () => engine.seekBy(5),
      ArrowDown: () => engine.seekBy(-5),
      ArrowUp: () => engine.seekBy(5),
      PageDown: () => engine.seekBy(-30),
      PageUp: () => engine.seekBy(30),
      Home: () => engine.seek(0),
      End: () => engine.seek(duration - 1),
    }
    const fn = keys[e.key]
    if (fn) {
      e.preventDefault()
      e.stopPropagation()
      fn()
    }
  }

  return (
    <div className={cn('flex w-full items-center gap-3', className)}>
      {showTimes && (
        <span
          ref={elapsedRef}
          className={cn('lc-tabular w-10 shrink-0 text-right text-[11px] text-muted-foreground', timeClassName)}
        >
          0:00
        </span>
      )}
      <div
        ref={barRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-disabled={disabled}
        data-dragging={dragFrac !== null}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          'lc-seek lc-focus group relative flex h-4 flex-1 cursor-pointer touch-none items-center rounded-full',
          disabled && 'cursor-default opacity-50',
        )}
      >
        <div className="lc-bar w-full">
          <div ref={fillRef} className="lc-bar-fill" style={{ transform: 'scaleX(0)' }} />
        </div>
        {!disabled && <div ref={thumbRef} className="lc-seek-thumb" style={{ left: '0%' }} />}
      </div>
      {showTimes && (
        <span className={cn('lc-tabular w-10 shrink-0 text-[11px] text-muted-foreground', timeClassName)}>
          {formatTime(duration)}
        </span>
      )}
    </div>
  )
}
