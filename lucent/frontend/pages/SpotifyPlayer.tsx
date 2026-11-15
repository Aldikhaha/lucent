import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { PageShell } from '../components/lucent/CollectionHeader'
import { isDesktop } from '../core/platform'
import { connectSpotify, type SpotifySession } from '../core/spotify'
import { getSpotifySongs, listSpotifyPlaylists, playSpotifyPlaylist, type SpotifyPlaylist, type SpotifySong } from '../core/spotifyApi'
import { loadSpotifySdk, type SpotifyPlaybackState, type SpotifyPlayer as SDKPlayer } from '../core/spotifySdk'
import { formatTime } from '../core/format'
import { usePlayer } from '../state/PlayerContext'
import spotifyLogo from '../assets/spotify-black.svg'
const primary = 'lc-focus rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40'
const secondary = 'lc-focus rounded-xl bg-[hsl(var(--lc-hover)/0.08)] px-3 py-2 text-sm hover:bg-[hsl(var(--lc-hover)/0.14)] disabled:opacity-40'
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e)
function Brand({ url }: { url: string }) { return <button type="button" onClick={() => void openUrl(url).catch(() => undefined)} aria-label="Open on Spotify" className="lc-focus inline-flex shrink-0 items-center rounded-lg bg-white px-3 py-2"><img src={spotifyLogo} alt="Spotify" className="w-20" /></button> }

export default function SpotifyPlayer() {
  const local = usePlayer()
  const [clientId, setClientId] = useState('')
  const [session, setSession] = useState<SpotifySession | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [selected, setSelected] = useState<SpotifyPlaylist | null>(null)
  const [songs, setSongs] = useState<SpotifySong[]>([])
  const [playback, setPlayback] = useState<SpotifyPlaybackState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [playlistPage, setPlaylistPage] = useState(0)
  const [songPage, setSongPage] = useState(0)
  const sdk = useRef<SDKPlayer | null>(null)
  const mounted = useRef(true)
  const abort = useRef<AbortController | null>(null)
  const active = useRef(false)
  function disconnect() {
    abort.current?.abort(); abort.current = null; active.current = false
    const player = sdk.current; sdk.current = null
    if (player) { void player.pause().catch(() => undefined); player.disconnect() }
    if (mounted.current) { setSession(null); setDeviceId(''); setPlaylists([]); setSelected(null); setSongs([]); setPlayback(null); setBusy(false) }
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; disconnect() } }, [])
  useEffect(() => { const unsubscribe = local.subscribe(() => { const status = local.getState().status; if (active.current && (status === 'playing' || status === 'loading')) { active.current = false; void sdk.current?.pause().catch(() => undefined) } }); return () => { unsubscribe() } }, [local])
  useEffect(() => { if (!session) return; const timer = setInterval(() => { void sdk.current?.getCurrentState().then((s) => { if (mounted.current) setPlayback(s) }).catch(() => undefined) }, 1000); return () => clearInterval(timer) }, [session])
  async function connect() {
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('')
    try {
      const s = await connectSpotify(clientId.trim(), controller.signal)
      const [items] = await Promise.all([s.getToken().then(listSpotifyPlaylists), loadSpotifySdk()])
      if (controller.signal.aborted || !mounted.current) return
      const p = new window.Spotify!.Player({ name: 'Lucent', volume: 0.8, getOAuthToken: (cb) => { void s.getToken().then(cb).catch((e) => { if (mounted.current) setError(errorText(e)) }) } })
      sdk.current = p
      p.addListener('ready', ({ device_id }: { device_id: string }) => { if (mounted.current && sdk.current === p) setDeviceId(device_id) })
      p.addListener('not_ready', () => { if (mounted.current && sdk.current === p) setDeviceId('') })
      p.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => { if (mounted.current && sdk.current === p) { setPlayback(state); active.current = !!state && !state.paused; if (active.current && ['playing', 'loading'].includes(local.getState().status)) { active.current = false; void p.pause().catch(() => undefined) } } })
      for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) p.addListener(event, ({ message }: { message: string }) => { if (mounted.current && sdk.current === p) setError(`Spotify: ${message}`) })
      setSession(s); setPlaylists(items); setPlaylistPage(0)
      if (!await p.connect()) throw new Error('Spotify player could not connect. Check your Premium account and WebView2 DRM support.')
    } catch (e) { if (!controller.signal.aborted && mounted.current) { disconnect(); setError(errorText(e)) } }
    finally { if (mounted.current) setBusy(false); if (abort.current === controller) abort.current = null }
  }
  async function choose(p: SpotifyPlaylist) {
    if (!session) return
    setBusy(true); setError(''); setSelected(null); setSongs([])
    try { const result = await getSpotifySongs(await session.getToken(), p.id); if (mounted.current) { setSelected(p); setSongs(result); setSongPage(0) } }
    catch (e) { if (mounted.current) setError(errorText(e)) } finally { if (mounted.current) setBusy(false) }
  }
  async function play(index: number) {
    const p = sdk.current
    if (!session || !selected || !deviceId || !p) return
    setError(''); local.pause(); active.current = true
    try { await p.activateElement(); await playSpotifyPlaylist(await session.getToken(), deviceId, selected.id, index) }
    catch (e) { active.current = false; setError(errorText(e)) }
  }
  async function control(fn: (p: SDKPlayer) => Promise<void>) { try { if (sdk.current) await fn(sdk.current) } catch (e) { setError(errorText(e)) } }
  const current = playback?.track_window.current_track
  const image = current?.album.images.find((x) => /^https:\/\/i\.scdn\.co\//.test(x.url))?.url
  return <PageShell><header className="pb-6 pt-4"><Link to="/playlists" className="text-sm text-muted-foreground hover:text-foreground">← Playlists</Link><h1 className="mt-3 text-[32px] font-semibold tracking-tight">Spotify playback</h1><p className="mt-1 text-sm text-muted-foreground">Experimental · Stream your Spotify playlists in Lucent.</p></header>
    <div className="max-w-3xl space-y-5 pb-10"><div className="lc-glass space-y-3 rounded-2xl p-5 text-sm"><Brand url="https://developer.spotify.com/dashboard" /><p>Spotify Premium is required. This uses Spotify’s official Web Playback SDK, not downloads or local-file matching. Spotify audio is not processed by Lucent’s equalizer.</p><p className="text-muted-foreground">In the Spotify developer dashboard, create an app with Web API and Web Playback SDK, register <code>http://127.0.0.1/callback</code>, and paste its Client ID below. Never enter a client secret. Developer-mode access and playlist restrictions apply.</p><p className="text-muted-foreground">Spotify playback stops when you leave this screen or disconnect. Tokens stay in memory. If the player cannot initialize, your Windows WebView2 may not support Spotify’s protected playback.</p></div>
    {!isDesktop ? <p role="alert">Spotify sign-in requires the Windows desktop app.</p> : !session ? <div className="flex flex-wrap gap-2"><input className="lc-focus lc-glass min-w-[240px] flex-1 rounded-xl px-3 py-2 text-sm" aria-label="Spotify Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Spotify Client ID" autoComplete="off"/><button className={primary} disabled={busy} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect to Spotify'}</button>{busy && <button className={secondary} onClick={() => abort.current?.abort()}>Cancel</button>}</div> : <>
      <div className="flex items-center justify-between gap-3"><p className="text-sm">{deviceId ? 'Spotify player ready' : 'Connecting Spotify player…'}</p><button className={secondary} onClick={disconnect}>Disconnect</button></div>
      {current && <section className="lc-glass flex flex-wrap items-center gap-4 rounded-2xl p-4" aria-label="Spotify now playing">{image && <img src={image} alt="" className="h-20 w-20 rounded-xl object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate font-semibold">{current.name}</p><p className="truncate text-sm text-muted-foreground">{current.artists.map(a => a.name).join(', ')}</p>{current.id && <div className="mt-2"><Brand url={`https://open.spotify.com/track/${current.id.replace(/[^A-Za-z0-9]/g, '')}`} /></div>}</div><div className="flex gap-2"><button className={secondary} aria-label="Spotify previous" onClick={() => void control(p => p.previousTrack())}><SkipBack size={18}/></button><button className={primary} aria-label={playback?.paused ? 'Spotify play' : 'Spotify pause'} onClick={() => { if (playback?.paused) { local.pause(); active.current = true } void control(p => p.togglePlay()) }}>{playback?.paused ? <Play size={18}/> : <Pause size={18}/>}</button><button className={secondary} aria-label="Spotify next" onClick={() => void control(p => p.nextTrack())}><SkipForward size={18}/></button></div><label className="flex w-full items-center gap-3 text-xs text-muted-foreground"><span>{formatTime((playback?.position ?? 0)/1000)}</span><input className="flex-1" aria-label="Spotify seek" type="range" min="0" max={playback?.duration ?? 0} value={Math.min(playback?.position ?? 0, playback?.duration ?? 0)} onChange={(e) => void control(p => p.seek(Number(e.target.value)))}/><span>{formatTime((playback?.duration ?? 0)/1000)}</span></label></section>}
      <h2 className="font-semibold">Your Spotify playlists</h2>{!playlists.length && <p className="text-sm text-muted-foreground">No playlists found.</p>}<div className="lc-glass divide-y divide-[hsl(var(--lc-stroke)/0.1)] rounded-xl">{playlists.slice(playlistPage*20,playlistPage*20+20).map(p => <div key={p.id} className="flex items-center justify-between gap-3 p-3"><span className="truncate text-sm">{p.name}</span><div className="flex items-center gap-2"><Brand url={p.url}/><button className={secondary} disabled={busy} onClick={() => void choose(p)}>Open playlist</button></div></div>)}</div>
      {playlists.length > 20 && <div className="flex items-center gap-3 text-sm"><button className={secondary} disabled={!playlistPage} onClick={() => setPlaylistPage(playlistPage-1)}>Previous</button>Page {playlistPage+1} of {Math.ceil(playlists.length/20)}<button className={secondary} disabled={(playlistPage+1)*20>=playlists.length} onClick={() => setPlaylistPage(playlistPage+1)}>Next</button></div>}
      {selected && <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{selected.name}</h2><Brand url={selected.url}/></div><p className="text-xs text-muted-foreground">{songs.length} items · Spotify controls the playback queue.</p><div className="lc-glass divide-y divide-[hsl(var(--lc-stroke)/0.1)] rounded-xl">{songs.slice(songPage*20,songPage*20+20).map((song,j) => <div key={songPage*20+j} className="flex items-center gap-3 p-3">{song.image && <img src={song.image} alt="" className="h-11 w-11 rounded-lg object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm">{song.title}</p><p className="truncate text-xs text-muted-foreground">{song.artists.join(', ')}</p></div>{song.url && <Brand url={song.url}/>}<button className={secondary} disabled={!deviceId || !song.id || busy} aria-label={`Play ${song.title} on Spotify`} onClick={() => void play(songPage*20+j)}><Play size={16}/></button></div>)}</div>{songs.length>20 && <div className="flex items-center gap-3 text-sm"><button className={secondary} disabled={!songPage} onClick={() => setSongPage(songPage-1)}>Previous</button>Page {songPage+1} of {Math.ceil(songs.length/20)}<button className={secondary} disabled={(songPage+1)*20>=songs.length} onClick={() => setSongPage(songPage+1)}>Next</button></div>}</section>}
    </>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
  </PageShell>
}
