# Lucent for Windows (Tauri 2)

The desktop app renders the **same React code** as the web prototype in `../frontend`. Nothing is forked:
`src/main.tsx` mounts `frontend/App.tsx` directly, and the shared code switches to native implementations
when it detects Tauri (`frontend/core/platform`).

```
desktop/
  index.html, src/main.tsx   Desktop entry (replaces the Retool-hosted frontend/index.tsx)
  src/theme.ts               Light/dark follows Windows
  src/guards.ts              Release builds: no browser context menu / reload / print / find
  src/vendor/shadcn/         Copies of the shadcn components the app uses (frontend/lib/shadcn is not in git)
  vite.config.ts             Builds ../frontend; resolves every dependency from desktop/node_modules
  src-tauri/
    src/lib.rs               Plugins, commands, single instance
    src/library.rs           Folder scanning, byte-range reads, asset access for library files
    src/tray.rs              Tray icon with playback controls
    tauri.conf.json          Frameless window, CSP, installer, file associations
    capabilities/default.json
```

## Get a ready-made installer (no tools needed)

Open **Actions → Build Windows installer** in the repository, select a successful run and download **Lucent-Windows-Installer**. Extract the ZIP and run the setup EXE. The installer is built on GitHub's Windows runner and includes the offline WebView2 installer. Actions artifacts require GitHub sign-in and expire under the repository's retention policy.

The workflow lives in the repository root at `.github/workflows/build-windows.yml`. It runs on pushes to `main` or manually for a selected branch. The installer is unsigned, so Windows SmartScreen may show a warning.

## Prerequisites for building locally (Windows 10/11)

1. **Rust**: install from <https://rustup.rs> (MSVC toolchain, the default).
2. **Microsoft C++ Build Tools**: Visual Studio Installer > "Desktop development with C++".
3. **WebView2**: preinstalled on Windows 10 (April 2018+) and 11.
4. **Node.js 22** and **pnpm**: `npm i -g pnpm`.

## First run

Get the repository (both `frontend/` and `desktop/` are needed), then from `desktop/`:

```powershell
pnpm install --ignore-workspace --frozen-lockfile   # desktop/ is standalone
pnpm app:icons                    # generates src-tauri/icons/* from app-icon.svg (required once)
pnpm app:dev                      # opens the app with hot reload
```

`--ignore-workspace` keeps this desktop package independent of any surrounding pnpm workspace.
`../frontend` does not need its own `node_modules`.

## Build the installer

```powershell
pnpm test                         # queue regression tests
pnpm tauri build --bundles nsis
```

Output: `src-tauri/target/release/bundle/nsis/Lucent_3.0.1_x64-setup.exe` (per-user, no admin).

## What changes on desktop

| Area | Web prototype | Windows app |
|---|---|---|
| Library storage | Audio copied into IndexedDB | **Files stay where they are**; only song details and artwork are stored |
| Import | `<input webkitdirectory>`, HTML5 drop | Native file/folder pickers, Explorer drag-and-drop with full paths |
| Playback | Blob URLs | Streamed from disk via the asset protocol (instant seeking, no RAM copy) |
| Moved files | n/a | Detected on launch; re-importing the folder **relinks** them; "Remove missing" in Settings |
| Window | Browser tab | Frameless window with a custom title bar; size/position/maximized are remembered |
| Background | n/a | **System tray** with Play/Pause, Previous, Next, Stop; optional close-to-tray |
| Media keys | Media Session (when the browser supports it) | Global media keys (toggle in Settings) |
| Explorer | n/a | "Open with Lucent" + file associations; double-clicking a song imports and plays it; single instance |
| Track menu | n/a | "Show in File Explorer" |

Everything else (UI, queue, shuffle/loop, history, keyboard shortcuts, appearance settings, session restore)
is the shared code, unchanged.

## Notes

- Tag reading reuses the JS parsers (`frontend/core/tags`) over `read_range`; decoding uses WebView2's codecs.
  Formats match the web version: MP3, M4A/AAC, FLAC, WAV, OGG/Opus.
- The asset protocol starts with an empty scope; Rust allows each library file individually
  (`scan_paths`, `register_library_files`). The webview cannot read arbitrary files.
- File associations register Lucent as a handler for audio files. Windows still lets the user choose the default app.
- Next native steps, from `frontend/notes/ARCHITECTURE.md`: `lofty` tag reading, SQLite library, and
  `symphonia` + `souvlaki` for gapless playback and the Windows media overlay (SMTC).
