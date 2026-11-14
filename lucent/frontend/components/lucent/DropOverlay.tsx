import { useEffect, useRef, useState } from 'react'
import { FolderDown } from 'lucide-react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useLibrary } from '../../state/LibraryContext'
import { isDesktop } from '../../core/platform'

/** Browser: HTML5 drag events; files arrive as File objects. */
function useWebDrop(setActive: (v: boolean) => void) {
  const { importDropped } = useLibrary()
  const depth = useRef(0)

  useEffect(() => {
    if (isDesktop) return
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setActive(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e) || !e.dataTransfer) return
      e.preventDefault()
      depth.current = 0
      setActive(false)
      void importDropped(e.dataTransfer)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importDropped, setActive])
}

/** Desktop: the native window reports dropped paths from Explorer. */
function useDesktopDrop(setActive: (v: boolean) => void) {
  const { importPaths } = useLibrary()

  useEffect(() => {
    if (!isDesktop) return
    let disposed = false
    let unlisten: (() => void) | null = null
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload
        if (p.type === 'enter') setActive(p.paths.length > 0)
        else if (p.type === 'leave') setActive(false)
        else if (p.type === 'drop') {
          setActive(false)
          if (p.paths.length) void importPaths(p.paths)
        }
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [importPaths, setActive])
}

/** Full-window drop target for files and folders dragged in from Explorer. */
export function DropOverlay() {
  const [active, setActive] = useState(false)
  useWebDrop(setActive)
  useDesktopDrop(setActive)

  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--background)/0.4)] p-6 backdrop-blur-sm duration-150 animate-in fade-in-0">
      <div className="lc-glass-float flex h-full w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-[color:var(--lc-accent)]">
        <FolderDown className="lc-accent-text h-10 w-10" strokeWidth={1.5} />
        <p className="text-lg font-medium text-foreground">Drop to import</p>
        <p className="text-sm text-muted-foreground">
          {isDesktop
            ? 'Folders are read recursively. Files stay where they are; duplicates are skipped.'
            : 'Folders are read recursively. Duplicates are skipped.'}
        </p>
      </div>
    </div>
  )
}
