/**
 * Wraps a Tauri `listen`-style promise of an unlisten function into a synchronous cleanup,
 * safe to call before the promise resolves (React effect cleanup).
 */
export function disposer(p: Promise<() => void>): () => void {
  let off: (() => void) | null = null
  let disposed = false
  p.then((fn) => {
    if (disposed) fn()
    else off = fn
  }).catch(() => undefined)
  return () => {
    disposed = true
    off?.()
  }
}
