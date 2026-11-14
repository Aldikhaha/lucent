/**
 * Makes the webview behave like a native app in release builds:
 * no browser context menu, reload, print or find, and no dragging images/links out of the window.
 * Dev builds keep these so DevTools (right-click > Inspect) and reload stay available.
 */
if (!import.meta.env.DEV) {
  const isEditable = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

  window.addEventListener('contextmenu', (e) => {
    if (!isEditable(e.target)) e.preventDefault()
  })

  window.addEventListener(
    'keydown',
    (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const blocked =
        e.key === 'F5' ||
        e.key === 'F3' ||
        e.key === 'F7' ||
        (ctrl && (key === 'r' || key === 'p' || key === 'f' || key === 'g' || key === 'u' || key === 'j')) ||
        (ctrl && e.shiftKey && (key === 'i' || key === 'c'))
      if (blocked) e.preventDefault()
    },
    { capture: true },
  )

  window.addEventListener('dragstart', (e) => {
    const t = e.target
    if (t instanceof HTMLImageElement || t instanceof HTMLAnchorElement) e.preventDefault()
  })
}

export {}
