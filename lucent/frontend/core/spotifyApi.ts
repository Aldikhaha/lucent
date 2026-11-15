export interface SpotifyPlaylist { id: string; name: string; url: string }
export interface SpotifySong { id: string | null; title: string; artists: string[]; duration: number; url: string | null; image: string | null; unavailable?: boolean }
interface Page<T> { items: T[]; next: string | null }
const API = 'https://api.spotify.com/v1'
const validId = (id: string) => /^[A-Za-z0-9]{1,64}$/.test(id)
async function getPage<T>(path: string, token: string): Promise<Page<T>> {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
  if (response.status === 401) throw new Error('Spotify session expired. Connect again.')
  if (response.status === 403) throw new Error('Spotify denied access. Development mode supports playlists you own or collaborate on; verify your app and allowed users.')
  if (response.status === 429) throw new Error(`Spotify is rate-limiting requests. Try again${response.headers.get('Retry-After') ? ` in ${response.headers.get('Retry-After')} seconds` : ' later'}.`)
  if (!response.ok) throw new Error(`Spotify request failed (${response.status}).`)
  const data = await response.json() as Page<T>
  if (!data || !Array.isArray(data.items)) throw new Error('Spotify returned an unexpected response.')
  return data
}
async function pages<T>(path: string, token: string): Promise<T[]> {
  const results: T[] = []
  // Build offsets ourselves; never send a bearer token to a URL provided in a response.
  for (let offset = 0; offset < 10000;) {
    const page = await getPage<T>(`${path}?limit=50&offset=${offset}`, token)
    results.push(...page.items)
    if (!page.next) return results
    if (!page.items.length) throw new Error('Spotify returned an empty page with a continuation.')
    offset += page.items.length
  }
  throw new Error('This playlist is too large to import in the experimental version.')
}
export async function listSpotifyPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const list = await pages<{ id?: unknown; name?: unknown }>('/me/playlists', token)
  return list.flatMap((item) => typeof item?.id === 'string' && validId(item.id) && typeof item.name === 'string'
    ? [{ id: item.id, name: item.name, url: `https://open.spotify.com/playlist/${item.id}` }] : [])
}
export async function getSpotifySongs(token: string, playlistId: string): Promise<SpotifySong[]> {
  if (!validId(playlistId)) throw new Error('Invalid Spotify playlist.')
  const rows = await pages<{ item?: { type?: string; id?: string | null; name?: string; artists?: Array<{ name?: string }>; duration_ms?: number; album?: { images?: Array<{url?: string}> } } | null; is_local?: boolean }>(`/playlists/${playlistId}/items`, token)
  return rows.map((row) => {
    const item = row?.item
    if (!item || item.type !== 'track' || !item.name || !Array.isArray(item.artists)) return { id: null, title: 'Unavailable or unsupported item', artists: [], duration: 0, url: null, image: null, unavailable: true }
    const id = typeof item.id === 'string' && validId(item.id) ? item.id : null
    const image = item.album?.images?.find((image) => typeof image.url === 'string' && /^https:\/\/i\.scdn\.co\//.test(image.url))?.url ?? null
    return { id, title: item.name, artists: item.artists.map((a) => a.name ?? '').filter(Boolean), duration: (item.duration_ms ?? 0) / 1000, url: id ? `https://open.spotify.com/track/${id}` : null, image }
  })
}

export async function playSpotifyPlaylist(token: string, deviceId: string, playlistId: string, position: number): Promise<void> {
  if (!validId(playlistId) || !deviceId || !Number.isInteger(position) || position < 0) throw new Error('Invalid Spotify playback request.')
  const response = await fetch(`${API}/me/player/play?${new URLSearchParams({ device_id: deviceId })}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}`, offset: { position } }) })
  if (response.status === 403) throw new Error('Spotify denied playback. Check Premium, app permissions, and your account’s region.')
  if (response.status === 401) throw new Error('Spotify session expired. Reconnect.')
  if (response.status === 429) throw new Error('Spotify is rate-limiting playback requests. Try again later.')
  if (!response.ok) throw new Error(`Spotify could not start playback (${response.status}).`)
}
