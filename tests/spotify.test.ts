import test from 'node:test'
import assert from 'node:assert/strict'
import { getSpotifySongs, listSpotifyPlaylists, playSpotifyPlaylist } from '../lucent/frontend/core/spotifyApi'
import { recordingIdentity } from '../lucent/frontend/core/recordingIdentity'
import type { Track } from '../lucent/frontend/core/types'
const track = (id: string, title = 'Song', artist = 'Artist', duration = 180): Track => ({ id, title, artist, duration, album: 'Album', albumArtist: artist, trackNo: null, year: null, folder: '', fileName: id, size: 1, mime: '', format: '', artworkId: null, accent: null, lyrics: null, addedAt: 0, lastPlayedAt: null, playCount: 0, fingerprint: id })

test('recording identity is conservative and normalizes tags', () => {
  assert.deepEqual(recordingIdentity(track('1', ' SONG ', 'ARTIST')), recordingIdentity(track('2')))
  assert.equal(recordingIdentity(track('3', 'Song', 'Unknown Artist')), null)
  assert.equal(recordingIdentity(track('4', 'Song', 'Artist', 0)), null)
  assert.notDeepEqual(recordingIdentity(track('5', 'Song (Live)')), recordingIdentity(track('2')))
})
test('Spotify pagination stays on the API origin, and handles unavailable entries', async () => {
  const original = globalThis.fetch; const calls: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    const parsed = new URL(String(url))
    assert.equal(parsed.origin, 'https://api.spotify.com')
    if (parsed.pathname === '/v1/me/playlists') {
      const offset = parsed.searchParams.get('offset')
      return Response.json(offset === '0' ? { items: [{ id: 'abc', name: 'Mix' }], next: 'https://evil.example/steal' } : { items: [{ id: 'def', name: 'Other' }], next: null })
    }
    return Response.json({items: [{item: {type: 'track', id: '123', name: 'Song', artists: [{name: 'Artist'}], duration_ms: 180000}}, {item: null}, {item: {type: 'episode'}}], next: null})
  }) as typeof fetch
  try {
    assert.equal((await listSpotifyPlaylists('token')).length, 2)
    assert.match(calls[1]!, /offset=1/)
    const songs = await getSpotifySongs('token', 'abc')
    assert.equal(songs[0]?.duration, 180)
    assert.equal(songs[1]?.unavailable, true)
    assert.equal(songs[2]?.unavailable, true)
    await assert.rejects(getSpotifySongs('token', '../bad'), /Invalid/)
  } finally { globalThis.fetch = original }
})
test('Spotify errors surface an actionable explanation', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response('', {status: 403})) as typeof fetch
  try { await assert.rejects(listSpotifyPlaylists('token'), /denied access/) } finally { globalThis.fetch = original }
})

test('Spotify playback starts the selected playlist position on the intended device', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    const parsed = new URL(String(url)); assert.equal(parsed.origin, 'https://api.spotify.com'); assert.equal(parsed.searchParams.get('device_id'), 'device')
    assert.deepEqual(JSON.parse(String(options?.body)), { context_uri: 'spotify:playlist:abc', offset: {position: 2} })
    return new Response(null, { status: 204 })
  }) as typeof fetch
  try { await playSpotifyPlaylist('token', 'device', 'abc', 2); await assert.rejects(playSpotifyPlaylist('token', 'device', '../bad', 0), /Invalid/) } finally { globalThis.fetch = original }
})
