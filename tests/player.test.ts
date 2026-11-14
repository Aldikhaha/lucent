import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerEngine } from '../lucent/frontend/core/player'

class FakeAudio extends EventTarget {
  preload = ''
  volume = 1
  muted = false
  loop = false
  ended = false
  duration = 100
  currentTime = 0
  src = ''
  getAttribute(name: string) {
    return name === 'src' ? this.src || null : null
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
  load() {}
  pause() {
    this.dispatchEvent(new Event('pause'))
  }
  async play() {
    this.dispatchEvent(new Event('playing'))
  }
}
const values = new Map<string, string>()
Object.assign(globalThis, {
  Audio: FakeAudio,
  window: { addEventListener() {} },
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
})
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
function engine() {
  values.clear()
  return new PlayerEngine({
    loadSource: async (id) => ({ url: id }),
    describe: () => null,
    artworkUrl: async () => null,
    onStarted() {},
    onError() {},
  })
}

test('play queue removes duplicates and preserves the selected song', () => {
  const p = engine()
  p.playQueue(['a', 'b', 'a', 'c'], 2)
  assert.deepEqual(p.getState().queue, ['a', 'b', 'c'])
  assert.equal(p.currentId, 'a')
})

test('adding existing songs does not duplicate them', () => {
  const p = engine()
  p.playQueue(['a', 'b'])
  assert.equal(p.addToQueue(['b', 'c', 'c']), 1)
  assert.deepEqual(p.getState().queue, ['a', 'b', 'c'])
  assert.equal(p.addToQueue(['a', 'c']), 0)
})

test('play next moves an existing song, including from history', () => {
  const p = engine()
  p.playQueue(['a', 'b', 'c'], 1)
  assert.equal(p.playNext(['a', 'c', 'a', 'b']), 2)
  assert.deepEqual(p.getState().queue, ['b', 'a', 'c'])
  assert.equal(p.getState().index, 0)
  p.toggleShuffle()
  p.toggleShuffle()
  assert.deepEqual(p.getState().queue, ['b', 'a', 'c'])
})

test('restoring old sessions removes duplicates and missing tracks', () => {
  values.clear()
  values.set(
    'lucent.session.v1',
    JSON.stringify({
      queue: ['a', 'b', 'a', 'gone'],
      source: ['a', 'b', 'a', 'gone'],
      index: 2,
      repeat: 'off',
      shuffle: false,
      volume: 0.5,
      muted: false,
      time: 9,
      contextLabel: null,
    }),
  )
  const p = new PlayerEngine({
    loadSource: async (id) => ({ url: id }),
    describe: () => null,
    artworkUrl: async () => null,
    onStarted() {},
    onError() {},
  })
  p.restore(new Set(['a', 'b']))
  assert.deepEqual(p.getState().queue, ['a', 'b'])
  assert.equal(p.currentId, 'a')
})

test('clearing shuffled upcoming songs keeps original order for retained tracks', () => {
  const p = engine()
  p.playQueue(['a', 'b', 'c', 'd'], 1)
  p.toggleShuffle()
  p.jumpTo(2)
  const kept = new Set(p.getState().queue.slice(0, 3))
  p.clearUpcoming()
  p.toggleShuffle()
  assert.deepEqual(
    p.getState().queue,
    ['a', 'b', 'c', 'd'].filter((id) => kept.has(id)),
  )
})

test('a failed new source does not leave previous audio playing', async () => {
  values.clear()
  const p = new PlayerEngine({
    loadSource: async (id) => (id === 'a' ? { url: 'a' } : null),
    describe: () => null,
    artworkUrl: async () => null,
    onStarted() {},
    onError() {},
  })
  p.playQueue(['a', 'b'])
  await tick()
  assert.equal(p.audio.getAttribute('src'), 'a')
  p.next()
  await tick()
  assert.equal(p.audio.getAttribute('src'), null)
  assert.equal(p.getState().status, 'paused')
})

test('removing the current track selects a remaining song without autoplay', async () => {
  const p = engine()
  p.playQueue(['a', 'b', 'c'], 1)
  await tick()
  p.removeTracks(new Set(['b']))
  await tick()
  assert.deepEqual(p.getState().queue, ['a', 'c'])
  assert.equal(p.currentId, 'c')
  assert.equal(p.getState().status, 'paused')
})

test('restoring a missing current track selects a valid song without old position', async () => {
  values.clear()
  values.set(
    'lucent.session.v1',
    JSON.stringify({
      queue: ['gone', 'b'],
      source: ['gone', 'b'],
      index: 0,
      repeat: 'off',
      shuffle: false,
      volume: 0.5,
      muted: false,
      time: 9,
      contextLabel: null,
    }),
  )
  const p = new PlayerEngine({
    loadSource: async (id) => ({ url: id }),
    describe: () => null,
    artworkUrl: async () => null,
    onStarted() {},
    onError() {},
  })
  p.restore(new Set(['b']))
  await tick()
  assert.equal(p.currentId, 'b')
  assert.equal(p.getTime(), 0)
  assert.equal(p.getState().status, 'paused')
})

test('jumping between songs retains the full queue without duplicates', async () => {
  const p = engine()
  p.playQueue(['a', 'b', 'c'])
  p.jumpTo(2)
  await tick()
  assert.deepEqual(p.getState().queue, ['a', 'b', 'c'])
  assert.equal(p.currentId, 'c')
  p.jumpTo(0)
  await tick()
  assert.deepEqual(p.getState().queue, ['a', 'b', 'c'])
  assert.equal(p.currentId, 'a')
})

test('stale asynchronous track loads release their sources and cannot replace the current song', async () => {
  values.clear()
  let finishA!: (value: { url: string; release: () => void }) => void
  let released = 0
  const p = new PlayerEngine({
    loadSource: (id) => id === 'a' ? new Promise((resolve) => { finishA = resolve }) : Promise.resolve({ url: id }),
    describe: () => null, artworkUrl: async () => null, onStarted() {}, onError() {},
  })
  p.playQueue(['a', 'b'])
  p.next()
  await tick()
  finishA({ url: 'a', release: () => released++ })
  await tick()
  assert.equal(p.currentId, 'b')
  assert.equal(p.audio.getAttribute('src'), 'b')
  assert.equal(released, 1)
})

test('equalizer validates bands and persists settings', () => {
  const p = engine()
  p.setEqualizer(false, [20, -20, 1, 2, 3])
  assert.deepEqual(p.getState().equalizer, { enabled: false, bands: [12, -12, 1, 2, 3] })
  p.setEqualizer(false, [1, 2])
  assert.deepEqual(p.getState().equalizer.bands, [12, -12, 1, 2, 3])
  const saved = JSON.parse(values.get('lucent.equalizer.v1')!)
  assert.deepEqual(saved.bands, [12, -12, 1, 2, 3])
})
