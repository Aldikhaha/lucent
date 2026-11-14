export type RepeatMode = 'off' | 'all' | 'one'
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped'

export interface PlayerState {
  queue: string[]
  index: number
  status: PlaybackStatus
  repeat: RepeatMode
  shuffle: boolean
  volume: number
  muted: boolean
  duration: number
  contextLabel: string | null
}

export interface MediaInfo {
  title: string
  artist: string
  album: string
  artworkId: string | null
}

/** A playable URL, plus cleanup (e.g. revoking an object URL) when the player moves on. */
export interface PlaybackSource {
  url: string
  release?: () => void
}

export interface PlayerDeps {
  /** Resolves a source for a track; null when it isn't in the library. May throw with a user-facing message. */
  loadSource(id: string): Promise<PlaybackSource | null>
  describe(id: string): MediaInfo | null
  artworkUrl(artworkId: string): Promise<string | null>
  onStarted(id: string): void
  onError(message: string): void
}

const SESSION_KEY = 'lucent.session.v1'

interface Session {
  queue: string[]
  source: string[]
  index: number
  repeat: RepeatMode
  shuffle: boolean
  volume: number
  muted: boolean
  time: number
  contextLabel: string | null
}

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * Framework-agnostic playback engine around a single HTMLAudioElement.
 * Exposes an external-store API (subscribe/getState) for React, with time updates on a separate channel
 * so that progress ticks never re-render the rest of the UI.
 */
export class PlayerEngine {
  readonly audio = new Audio()
  private state: PlayerState
  /** Unshuffled play order, used to restore order when shuffle is turned off */
  private source: string[] = []
  private listeners = new Set<() => void>()
  private timeListeners = new Set<() => void>()
  private source_: PlaybackSource | null = null
  private loadToken = 0
  private reportedToken = -1
  private time = 0
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private restoredTime = 0

  constructor(private readonly deps: PlayerDeps) {
    const s = this.readSession()
    this.source = s?.source ?? []
    this.restoredTime = s?.time ?? 0
    this.state = {
      queue: s?.queue ?? [],
      index: s?.index ?? -1,
      status: 'idle',
      repeat: s?.repeat ?? 'off',
      shuffle: s?.shuffle ?? false,
      volume: s?.volume ?? 0.8,
      muted: s?.muted ?? false,
      duration: 0,
      contextLabel: s?.contextLabel ?? null,
    }
    this.audio.preload = 'auto'
    this.audio.volume = this.state.volume
    this.audio.muted = this.state.muted
    this.audio.loop = this.state.repeat === 'one'
    this.bindAudio()
    this.bindMediaSession()
    window.addEventListener('pagehide', () => this.saveSession())
  }

  /* ---------------- external store ---------------- */
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getState = () => this.state
  subscribeTime = (l: () => void) => {
    this.timeListeners.add(l)
    return () => this.timeListeners.delete(l)
  }
  getTime = () => this.time

  get currentId(): string | null {
    return this.state.queue[this.state.index] ?? null
  }

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
    this.scheduleSave()
    if ('mediaSession' in navigator && patch.status) {
      navigator.mediaSession.playbackState =
        patch.status === 'playing' ? 'playing' : patch.status === 'idle' ? 'none' : 'paused'
    }
  }

  private setTime(t: number) {
    this.time = t
    this.timeListeners.forEach((l) => l())
  }

  /* ---------------- audio element ---------------- */
  private bindAudio() {
    const a = this.audio
    a.addEventListener('playing', () => {
      this.set({ status: 'playing' })
      if (this.reportedToken !== this.loadToken && this.currentId) {
        this.reportedToken = this.loadToken
        this.deps.onStarted(this.currentId)
      }
    })
    a.addEventListener('pause', () => {
      if (this.state.status === 'playing' && !this.audio.ended) this.set({ status: 'paused' })
      this.saveSession()
    })
    a.addEventListener('ended', () => this.handleEnded())
    a.addEventListener('timeupdate', () => this.setTime(a.currentTime))
    a.addEventListener('seeked', () => {
      this.setTime(a.currentTime)
      this.updatePositionState()
    })
    a.addEventListener('durationchange', () => {
      if (Number.isFinite(a.duration)) {
        this.set({ duration: a.duration })
        this.updatePositionState()
      }
    })
    a.addEventListener('error', () => {
      if (!a.getAttribute('src')) return
      const info = this.currentId ? this.deps.describe(this.currentId) : null
      this.deps.onError(`Couldn't play "${info?.title ?? 'this track'}". The file may be damaged or unsupported.`)
      this.set({ status: 'paused' })
    })
  }

  private async load(autoplay: boolean, startAt = 0) {
    const id = this.currentId
    const token = ++this.loadToken
    if (!id) {
      this.unloadSource()
      this.set({ status: 'idle', duration: 0 })
      return
    }
    this.set({ status: autoplay ? 'loading' : this.state.status === 'idle' ? 'paused' : this.state.status })
    let src: PlaybackSource | null
    try {
      src = await this.deps.loadSource(id)
    } catch (err) {
      if (token !== this.loadToken) return
      this.deps.onError(err instanceof Error ? err.message : 'This track could not be opened.')
      this.set({ status: 'paused' })
      return
    }
    if (token !== this.loadToken) {
      src?.release?.()
      return
    }
    if (!src) {
      this.deps.onError('This track is no longer in your library.')
      this.set({ status: 'paused' })
      return
    }
    this.releaseSource()
    this.source_ = src
    this.audio.src = src.url
    if (startAt > 0) {
      this.audio.addEventListener('loadedmetadata', () => (this.audio.currentTime = startAt), { once: true })
    }
    this.setTime(startAt)
    void this.updateMetadata(id)
    if (autoplay && this.state.status === 'loading') {
      try {
        await this.audio.play()
      } catch {
        if (token === this.loadToken) this.set({ status: 'paused' })
      }
    } else {
      this.set({ status: 'paused' })
    }
  }

  private releaseSource() {
    this.source_?.release?.()
    this.source_ = null
  }

  private unloadSource() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.releaseSource()
    this.setTime(0)
  }

  private handleEnded() {
    const { index, queue, repeat } = this.state
    if (index < queue.length - 1) {
      this.set({ index: index + 1 })
      void this.load(true)
    } else if (repeat === 'all' && queue.length) {
      this.set({ index: 0 })
      void this.load(true)
    } else {
      this.audio.currentTime = 0
      this.setTime(0)
      this.set({ status: 'stopped' })
    }
  }

  /* ---------------- public controls ---------------- */

  /** Restores the previous session once the library is known (never autoplays). */
  restore(validIds: Set<string>) {
    const keep = (ids: string[]) => ids.filter((id) => validIds.has(id))
    const currentId = this.currentId
    const queue = keep(this.state.queue)
    this.source = keep(this.source)
    const index = currentId ? queue.indexOf(currentId) : -1
    this.set({ queue, index })
    if (index >= 0) void this.load(false, currentId === this.currentId ? this.restoredTime : 0)
  }

  playQueue(ids: string[], startIndex = 0, contextLabel: string | null = null, forceShuffle?: boolean) {
    if (!ids.length) return
    const shuffle = forceShuffle ?? this.state.shuffle
    this.source = ids.slice()
    let queue = ids.slice()
    let index = Math.max(0, Math.min(startIndex, ids.length - 1))
    if (shuffle) {
      const start = forceShuffle ? (ids[Math.floor(Math.random() * ids.length)] as string) : ids[index]!
      queue = [start, ...shuffled(ids.filter((_, i) => i !== ids.indexOf(start)))]
      index = 0
    }
    this.set({ queue, index, shuffle, contextLabel })
    void this.load(true)
  }

  play() {
    if (this.state.index < 0) {
      if (this.state.queue.length) {
        this.set({ index: 0 })
        void this.load(true)
      }
      return
    }
    if (!this.audio.getAttribute('src')) {
      void this.load(true)
      return
    }
    this.audio.play().catch(() => this.set({ status: 'paused' }))
  }

  pause() {
    this.audio.pause()
    if (this.state.status === 'loading') this.set({ status: 'paused' })
  }

  toggle() {
    if (this.state.status === 'playing' || this.state.status === 'loading') this.pause()
    else this.play()
  }

  stop() {
    if (this.state.index < 0) return
    this.audio.pause()
    if (this.audio.getAttribute('src')) this.audio.currentTime = 0
    this.setTime(0)
    this.set({ status: 'stopped' })
    this.updatePositionState()
  }

  next() {
    const { index, queue, repeat } = this.state
    if (!queue.length) return
    if (index < queue.length - 1) {
      this.set({ index: index + 1 })
      void this.load(true)
    } else {
      // At the end: wrap around; keep playing only when looping the queue.
      this.set({ index: 0 })
      void this.load(repeat === 'all')
    }
  }

  previous() {
    const { index, queue, repeat } = this.state
    if (!queue.length) return
    if (this.time > 3 || (index === 0 && repeat !== 'all')) {
      this.seek(0)
      return
    }
    this.set({ index: index > 0 ? index - 1 : queue.length - 1 })
    void this.load(true)
  }

  seek(seconds: number) {
    if (!this.audio.getAttribute('src')) return
    const max = this.state.duration || this.audio.duration || 0
    const t = Math.max(0, Math.min(seconds, max ? max - 0.05 : seconds))
    this.audio.currentTime = t
    this.setTime(t)
  }

  seekBy(delta: number) {
    this.seek(this.time + delta)
  }

  setVolume(v: number) {
    const volume = Math.max(0, Math.min(1, v))
    this.audio.volume = volume
    const muted = volume === 0 ? this.state.muted : false
    this.audio.muted = muted
    this.set({ volume, muted })
  }

  toggleMute() {
    const muted = !this.state.muted
    this.audio.muted = muted
    if (!muted && this.state.volume === 0) this.setVolume(0.5)
    this.set({ muted })
  }

  cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const repeat = order[(order.indexOf(this.state.repeat) + 1) % order.length]!
    this.setRepeat(repeat)
  }

  setRepeat(repeat: RepeatMode) {
    this.audio.loop = repeat === 'one'
    this.set({ repeat })
  }

  toggleShuffle() {
    const cur = this.currentId
    if (!this.state.shuffle) {
      const rest = this.state.queue.filter((_, i) => i !== this.state.index)
      const queue = cur ? [cur, ...shuffled(rest)] : shuffled(this.state.queue)
      this.set({ shuffle: true, queue, index: cur ? 0 : this.state.index })
    } else {
      let queue = this.source.length ? this.source.slice() : this.state.queue.slice()
      let index = cur ? queue.indexOf(cur) : -1
      if (cur && index < 0) {
        queue = [cur, ...queue]
        index = 0
      }
      this.set({ shuffle: false, queue, index })
    }
  }

  jumpTo(index: number) {
    if (index < 0 || index >= this.state.queue.length) return
    this.set({ index })
    void this.load(true)
  }

  playNext(ids: string[]) {
    if (!ids.length) return
    if (this.state.index < 0) return this.playQueue(ids, 0, 'Queue')
    const queue = this.state.queue.slice()
    queue.splice(this.state.index + 1, 0, ...ids)
    const cur = this.currentId
    const srcIdx = cur ? this.source.indexOf(cur) : -1
    this.source.splice(srcIdx + 1, 0, ...ids)
    this.set({ queue })
  }

  addToQueue(ids: string[]) {
    if (!ids.length) return
    if (this.state.index < 0) return this.playQueue(ids, 0, 'Queue')
    this.source.push(...ids)
    this.set({ queue: [...this.state.queue, ...ids] })
  }

  removeFromQueue(index: number) {
    if (index === this.state.index || index < 0 || index >= this.state.queue.length) return
    const queue = this.state.queue.slice()
    const [removed] = queue.splice(index, 1)
    const srcIdx = removed ? this.source.indexOf(removed) : -1
    if (srcIdx >= 0) this.source.splice(srcIdx, 1)
    this.set({ queue, index: index < this.state.index ? this.state.index - 1 : this.state.index })
  }

  clearUpcoming() {
    const queue = this.state.queue.slice(0, this.state.index + 1)
    this.source = queue.slice()
    this.set({ queue })
  }

  /** Called when tracks are deleted from the library. */
  removeTracks(ids: Set<string>) {
    const cur = this.currentId
    const queue = this.state.queue.filter((id) => !ids.has(id))
    this.source = this.source.filter((id) => !ids.has(id))
    if (cur && ids.has(cur)) {
      this.unloadSource()
      this.loadToken++
      this.set({ queue, index: -1, status: 'idle', duration: 0 })
    } else {
      this.set({ queue, index: cur ? queue.indexOf(cur) : -1 })
    }
  }

  reset() {
    this.loadToken++
    this.unloadSource()
    this.source = []
    this.set({ queue: [], index: -1, status: 'idle', duration: 0, contextLabel: null })
  }

  /* ---------------- OS media integration ---------------- */
  private bindMediaSession() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const on = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        /* unsupported action */
      }
    }
    on('play', () => this.play())
    on('pause', () => this.pause())
    on('stop', () => this.stop())
    on('previoustrack', () => this.previous())
    on('nexttrack', () => this.next())
    on('seekbackward', (d) => this.seekBy(-(d.seekOffset ?? 10)))
    on('seekforward', (d) => this.seekBy(d.seekOffset ?? 10))
    on('seekto', (d) => {
      if (d.seekTime != null) this.seek(d.seekTime)
    })
  }

  private async updateMetadata(id: string) {
    if (!('mediaSession' in navigator)) return
    const info = this.deps.describe(id)
    if (!info) return
    const art = info.artworkId ? await this.deps.artworkUrl(info.artworkId) : null
    if (this.currentId !== id) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: info.album,
      artwork: art ? [{ src: art, sizes: '600x600', type: 'image/jpeg' }] : [],
    })
  }

  private updatePositionState() {
    if (!('mediaSession' in navigator) || !this.state.duration) return
    try {
      navigator.mediaSession.setPositionState({
        duration: this.state.duration,
        position: Math.min(this.time, this.state.duration),
        playbackRate: 1,
      })
    } catch {
      /* ignore */
    }
  }

  /* ---------------- persistence ---------------- */
  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveSession(), 600)
  }

  private saveSession() {
    const s: Session = {
      queue: this.state.queue,
      source: this.source,
      index: this.state.index,
      repeat: this.state.repeat,
      shuffle: this.state.shuffle,
      volume: this.state.volume,
      muted: this.state.muted,
      time: this.time,
      contextLabel: this.state.contextLabel,
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    } catch {
      /* storage full or unavailable */
    }
  }

  private readSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  }
}
