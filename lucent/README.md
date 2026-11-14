# Lucent

A fast, private music player for the music files on your PC, built with React and Tauri 2.

- `frontend/`: the app (React, TypeScript, Tailwind). Shared by the web prototype and the Windows app.
- `desktop/`: the Windows app shell (Tauri 2 + Rust). See [desktop/README.md](desktop/README.md).
- `.github/workflows/windows-installer.yml`: builds the Windows installer on GitHub.

## Get the Windows installer

Go to **Actions > Build Windows app > Run workflow**, wait about 10-15 minutes, then download
**Lucent-Windows** from the finished run. Push a tag like `v0.1.0` to publish a Release instead.

## Build locally

```powershell
cd desktop
pnpm install --ignore-workspace
pnpm app:icons
pnpm app:dev      # run with hot reload
pnpm app:build    # installers in src-tauri/target/release/bundle
```
