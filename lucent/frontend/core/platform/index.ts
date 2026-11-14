/**
 * True when running inside the Tauri desktop shell (Windows app), false in the browser prototype.
 * Desktop-only code paths live in ./desktop and are only called when this is true.
 */
export const isDesktop: boolean = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
