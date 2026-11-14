# Lucent

A fast, private music player for the music files on your PC, built with React and Tauri 2.

- `frontend/`: the app (React, TypeScript, Tailwind). Shared by the web prototype and the Windows app.
- `desktop/`: the Windows app shell (Tauri 2 + Rust). See [desktop/README.md](desktop/README.md).
- `.github/workflows/windows-installer.yml`: builds the Windows installer on GitHub.

## Lucent V2

Create playlists from the Playlists sidebar, add songs directly or from a song’s menu, reorder or remove songs, and play or shuffle a playlist. Playlists are saved locally on this device. Removing a playlist never deletes your music files.

Queue entries are unique: adding a song already in the queue will not duplicate it; Play next moves it immediately after the current song. Use loop mode to repeat a song or queue. Older duplicate-filled queues are cleaned on restore.

Now Playing has subtle particles. Turn them off in Settings → Appearance, or use reduced motion / Minimal animation to disable them automatically.

## Get the Windows installer

Open the repository's **Actions → Build Windows installer**, select a successful run, and download **Lucent-Windows-Installer**. Extract the ZIP and run the setup executable. GitHub sign-in may be required for artifact downloads; artifacts expire according to repository retention settings. The installer is unsigned and may trigger SmartScreen.

The workflow runs on pushes to main and can also be run manually for a chosen branch. It builds on a Windows runner; users do not need build tools.

## Build locally on Windows

```powershell
cd lucent/desktop
pnpm install --ignore-workspace --frozen-lockfile
pnpm test
pnpm app:icons
pnpm app:dev
# Or build the installer:
pnpm tauri build --bundles nsis
```

See `desktop/README.md` for platform prerequisites and implementation details.
