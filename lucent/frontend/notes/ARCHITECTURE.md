# Lucent — MVP architecture

One React codebase, two shells:
- **Web prototype** (Retool sandbox): `frontend/index.tsx` mounts `App.tsx`.
- **Windows app** (Tauri 2): `desktop/src/main.tsx` mounts the same `App.tsx`. See `desktop/README.md`.

Shared code checks `isDesktop` (`core/platform/index.ts`) and calls native features through
`core/platform/desktop.ts`, which wraps the Rust commands in `desktop/src-tauri/src`.

| Module | Web prototype | Windows app (now) | Later native step |
|---|---|---|---|
| `core/db.ts` | IndexedDB: `tracks`, `audio` (file blobs), `artwork` | IndexedDB for `tracks` + `artwork`; audio not stored, `Track.path` points at the file | SQLite (`rusqlite`) |
| `core/tags/*`, `core/metadata.ts` | Hand-written parsers over `BlobRangeReader` | Same parsers over `FileRangeReader` (`read_range` command) | `lofty` crate |
| `core/importer.ts` | `<input webkitdirectory>` + drag-drop entry walking | `scan_paths` (walkdir) from native dialogs, Explorer drops and "Open with" | file watching |
| `core/artwork.ts` | Downscale to 600px JPEG, accent extraction | unchanged | `image` crate |
| `core/player.ts` | `PlayerEngine` over `HTMLAudioElement`, blob URLs | Same engine, asset-protocol URLs; tray + global media keys | `symphonia` + `cpal`, `souvlaki` for SMTC |
| `state/*` | React contexts | + `missingIds`, `importPaths`, desktop prefs (`closeToTray`, `mediaKeys`) | unchanged |
| Desktop-only UI | — | `TitleBar`, `DesktopIntegration` (tray, media keys, close-to-tray, open-with) | — |

## Performance notes
- Progress bar paints via `requestAnimationFrame` directly to the DOM only while playing; no React re-renders per tick.
- Track lists are virtualized against the main scroll container (`hooks/useVirtualRows.ts`).
- Artwork loads lazily via `IntersectionObserver`; covers are deduplicated by content hash.
- Ambient background is static and crossfades only on track change.
- Reduced motion: `prefs.motion` (`system` follows `prefers-reduced-motion`) toggles `.lc-reduce-motion`.
- Desktop: no audio bytes are copied or held in IndexedDB; tags are read with a few small range reads per file.
