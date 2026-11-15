interface SpotifyTrack { id: string | null; name: string; artists: { name: string }[]; album: { images: { url: string }[] }; uri: string }
export interface SpotifyPlaybackState { paused: boolean; position: number; duration: number; track_window: { current_track: SpotifyTrack } }
type Listener = (data: any) => void
export interface SpotifyPlayer {
  addListener(event: string, callback: Listener): boolean
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  getCurrentState(): Promise<SpotifyPlaybackState | null>
  togglePlay(): Promise<void>
  pause(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  seek(ms: number): Promise<void>
}
declare global { interface Window { Spotify?: { Player: new (options: {name: string; getOAuthToken: (cb: (token: string) => void) => void; volume: number}) => SpotifyPlayer }; onSpotifyWebPlaybackSDKReady?: () => void } }
let loading: Promise<void> | null = null
/** Load the official SDK once; never download or decrypt audio ourselves. */
export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => fail('Spotify player took too long to load.'), 20000)
    const fail = (message: string) => { clearTimeout(timeout); script.remove(); delete window.onSpotifyWebPlaybackSDKReady; reject(new Error(message)) }
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); delete window.onSpotifyWebPlaybackSDKReady; window.Spotify ? resolve() : fail('Spotify player failed to initialize.') }
    script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true
    script.onerror = () => fail('Could not load the Spotify player. Check your connection.')
    document.head.appendChild(script)
  }).catch((error) => { loading = null; throw error })
  return loading
}
