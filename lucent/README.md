# Lucent

A fast, private music player for the music files on your PC, built with React and Tauri 2.

- `frontend/`: the app (React, TypeScript, Tailwind). Shared by the web prototype and the Windows app.
- `desktop/`: the Windows app shell (Tauri 2 + Rust). See [desktop/README.md](desktop/README.md).
- `.github/workflows/build-windows.yml`: builds the Windows installer on GitHub.

## Lucent V4 (experimental Spotify playback)

The queue skips likely duplicate recordings across different files when their title and artist match (ignoring case and spacing) and their durations are within two seconds. This does not delete files or saved playlist entries, and preserves the current or explicitly chosen file. Turn off **Skip likely duplicate songs** in Settings for distinct versions sharing tags and duration; replay a playlist to rebuild its queue. Missing or inaccurate tags can prevent detection.

Spotify streaming uses the official Web Playback SDK; no local-file matching or downloading is involved. Spotify Premium and a compatible Windows WebView2 with protected playback are required. This is a separate experimental screen: playback stops when you leave it or disconnect. Spotify manages its own queue, and Lucent's local equalizer and island controls do not control Spotify audio. Tracks unavailable in your region or playlists restricted by Spotify cannot be played through this interface.

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), enabling Web API and Web Playback SDK. Spotify developer-mode requirements and allowlisted-user restrictions apply.
2. Register `http://127.0.0.1/callback` as a redirect URI; Lucent uses an ephemeral loopback port. Copy the Client ID, **not** the client secret.
3. Open Playlists → Listen with Spotify in Lucent, enter the Client ID, approve browser sign-in, open an accessible playlist, and press a song's play button. Spotify access tokens and refresh tokens are kept only in memory while this screen is open.

Spotify allows a development app to read the contents of playlists owned by or collaborated on by the signed-in user, and a Spotify Premium subscription is required to stream. See [playlist access](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items), [redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) and [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk).

The island now uses an explicit drag surface (artwork or empty space) and offers expandable controls and a queue preview. The animated bars indicate playback state, not audio analysis. It controls local playback only.

## Lucent V3

Use the mini-player button in the playback bar for a compact, always-on-top Windows window; restore with the expand button. Playback continues in the same window. In the browser preview the compact layout does not create a separate window.

Playlist covers can be selected on the playlist page. Images are cropped and stored locally; removing a playlist does not delete music files. Saved playlists and playback queues are separate: after editing a playlist, play it again to refresh the queue. The queue shows played, current, and upcoming songs.

Settings → Appearance offers Performance and Full effects (24 or 72 particles), with particle, rain, snow and aurora styles. Full is more graphics-intensive; actual performance depends on the machine. Effects pause with playback and respect reduced motion. Settings → Equalizer provides five bands, presets, and automatic headroom for boosts.

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
pnpm exec playwright install chromium
pnpm test:ui
pnpm app:icons
pnpm app:dev
# Or build the installer:
pnpm tauri build --bundles nsis
```

See `desktop/README.md` for platform prerequisites and implementation details.
