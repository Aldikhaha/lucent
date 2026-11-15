import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

/** PKCE + one-use loopback callback. Client secret is never used; tokens stay in memory. */
export async function connectSpotify(clientId: string, signal?: AbortSignal): Promise<SpotifySession> {
  if (!/^[a-fA-F0-9]{32}$/.test(clientId)) throw new Error('Enter the 32-character Spotify Client ID from your developer dashboard.')
  const verifier = randomHex(32), state = randomHex(24)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  if (signal?.aborted) throw new Error('Sign-in cancelled.')
  const cancel = () => { void cancelSpotifyConnect() }
  signal?.addEventListener('abort', cancel, { once: true })
  let redirect: string
  try {
    redirect = await invoke<string>('spotify_auth_start', { expected: state })
    if (signal?.aborted) { await cancelSpotifyConnect(); throw new Error('Sign-in cancelled.') }
    const auth = new URL('https://accounts.spotify.com/authorize')
    auth.search = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirect, state, scope: 'streaming user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative', code_challenge_method: 'S256', code_challenge: base64url(new Uint8Array(digest)) }).toString()
    await openUrl(auth.toString())
    if (signal?.aborted) throw new Error('Sign-in cancelled.')
    const code = await invoke<string>('spotify_auth_wait')
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier }), signal: signal ?? null,
    })
    if (!response.ok) throw new Error('Spotify could not complete sign-in. Check the Client ID and redirect URI in your developer dashboard.')
    const result = await response.json() as TokenResponse
    if (!result.access_token || !result.refresh_token) throw new Error('Spotify did not return the required tokens.')
    return new SpotifySession(clientId, result)
  } catch (error) {
    await invoke('spotify_auth_cancel').catch(() => undefined)
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
export const cancelSpotifyConnect = () => invoke('spotify_auth_cancel').catch(() => undefined)


interface TokenResponse { access_token?: string; refresh_token?: string; expires_in?: number }
/** Tokens live in memory only and are discarded when the player disconnects. */
export class SpotifySession {
  private token: string
  private refreshToken: string
  private expiry: number
  private refreshing: Promise<string> | null = null
  constructor(private clientId: string, result: TokenResponse) {
    this.token = result.access_token!; this.refreshToken = result.refresh_token!; this.expiry = Date.now() + (result.expires_in ?? 3600) * 1000
  }
  async getToken(): Promise<string> {
    if (Date.now() < this.expiry - 60000) return this.token
    if (this.refreshing) return this.refreshing
    this.refreshing = (async () => {
      const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.clientId, grant_type: 'refresh_token', refresh_token: this.refreshToken }) })
      if (!response.ok) throw new Error('Spotify session expired. Disconnect and reconnect.')
      const result = await response.json() as TokenResponse
      if (!result.access_token) throw new Error('Spotify did not refresh the session.')
      this.token = result.access_token; this.refreshToken = result.refresh_token ?? this.refreshToken; this.expiry = Date.now() + (result.expires_in ?? 3600) * 1000
      return this.token
    })().finally(() => { this.refreshing = null })
    return this.refreshing
  }
}
