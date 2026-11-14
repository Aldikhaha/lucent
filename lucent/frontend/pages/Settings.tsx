import { useEffect, useState, type ReactNode } from 'react'
import { FilePlus2, FolderPlus, HardDrive, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer, usePlayerState, useTrackActions } from '../state/PlayerContext'
import { EQ_FREQUENCIES } from '../core/player'
import { usePrefs, type MotionPref, type EffectQuality, type EffectType } from '../state/PrefsContext'
import { formatBytes, plural } from '../core/format'
import { AUDIO_EXTENSIONS } from '../core/importer'
import { isDesktop } from '../core/platform'
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts'
import { PageShell } from '../components/lucent/CollectionHeader'
import { ConfirmDialog } from '../components/lucent/ConfirmDialog'
import { Slider } from '../lib/shadcn/slider'
import { Switch } from '../lib/shadcn/switch'
import { ToggleGroup, ToggleGroupItem } from '../lib/shadcn/toggle-group'

export const APP_VERSION = '3.0.0'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="lc-glass mt-3 divide-y divide-[hsl(var(--lc-stroke)/0.07)] rounded-[16px] px-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-[13px] text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

const pillBtn =
  'lc-focus flex h-8 items-center gap-2 rounded-full bg-[hsl(var(--lc-hover)/0.07)] px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.12)] disabled:opacity-40'

const segItem =
  'h-7 rounded-full px-3 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-[hsl(var(--lc-hover)/0.1)] data-[state=on]:text-foreground'

function useStorageEstimate(dep: unknown) {
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!navigator.storage?.estimate) return
      const [e, persisted] = await Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(false),
      ])
      if (!cancelled) setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0, persisted })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [dep])
  return est
}

export default function Settings() {
  const { tracks, albums, pickFiles, pickFolder, missingIds, checkMissing } = useLibrary()
  const { clearLibrary, removeTracks } = useTrackActions()
  const { prefs, setPref, resetPrefs } = usePrefs()
  const engine = usePlayer()
  const { equalizer } = usePlayerState()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmMissing, setConfirmMissing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [persistTick, setPersistTick] = useState(0)
  const storage = useStorageEstimate(`${tracks.length}-${persistTick}`)

  return (
    <PageShell className="max-w-[760px]">
      <header className="pb-8 pt-4">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Settings</h1>
      </header>

      <Section
        title="Library"
        description={
          isDesktop
            ? 'Lucent plays your music from where it is on this PC. Nothing is copied.'
            : "Imported songs are copied into Lucent's private storage on this device."
        }
      >
        <Row label="Your music" hint={`${plural(tracks.length, 'song')} · ${plural(albums.length, 'album')}`}>
          <button type="button" className={pillBtn} onClick={pickFolder}>
            <FolderPlus className="h-3.5 w-3.5" />
            Import folder
          </button>
          <button type="button" className={pillBtn} onClick={pickFiles}>
            <FilePlus2 className="h-3.5 w-3.5" />
            Import files
          </button>
        </Row>
        {isDesktop && (
          <Row
            label="Missing files"
            hint={
              missingIds.size
                ? `${plural(missingIds.size, 'song')} can't be found on disk. Re-import a moved folder to relink.`
                : 'All songs were found on disk'
            }
          >
            <button
              type="button"
              className={pillBtn}
              disabled={checking || !tracks.length}
              onClick={() => {
                setChecking(true)
                void checkMissing().finally(() => setChecking(false))
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              Check
            </button>
            {missingIds.size > 0 && (
              <button type="button" className={`${pillBtn} text-destructive`} onClick={() => setConfirmMissing(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </Row>
        )}
        <Row
          label={isDesktop ? 'Library data' : 'Storage used'}
          hint={
            storage
              ? isDesktop
                ? `${formatBytes(storage.usage)} for artwork and song details`
                : `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} available to Lucent`
              : 'Storage information unavailable'
          }
        >
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </Row>
        {!isDesktop && (
          <Row
            label="Keep library on this device"
            hint={storage?.persisted ? 'Protected from automatic cleanup' : 'May be cleared if the device runs low on space'}
          >
            <button
              type="button"
              className={pillBtn}
              disabled={!!storage?.persisted || !navigator.storage?.persist}
              onClick={() => void navigator.storage.persist().finally(() => setPersistTick((t) => t + 1))}
            >
              {storage?.persisted ? 'Protected' : 'Protect'}
            </button>
          </Row>
        )}
        <Row
          label="Remove all music"
          hint={
            isDesktop
              ? 'Removes every song, its artwork and your history from Lucent. Your files stay on disk.'
              : 'Deletes every imported song, its artwork and your history'
          }
        >
          <button
            type="button"
            className={`${pillBtn} text-destructive`}
            disabled={!tracks.length}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove all
          </button>
        </Row>
      </Section>

      <Section
        title="Appearance"
        description={
          isDesktop ? 'Light and dark follow your Windows setting.' : 'Light and dark follow your system setting or the preview toolbar.'
        }
      >
        <Row label="Glass transparency" hint="How much of the background shows through panels">
          <Slider
            aria-label="Glass transparency"
            className="lc-slider w-44"
            min={0}
            max={100}
            step={1}
            value={[prefs.transparency]}
            onValueChange={(v) => setPref('transparency', v[0] ?? 55)}
          />
          <span className="lc-tabular w-9 text-right text-xs text-muted-foreground">{prefs.transparency}%</span>
        </Row>
        <Row label="Blur intensity" hint="Strength of the frosted-glass effect">
          <Slider
            aria-label="Blur intensity"
            className="lc-slider w-44"
            min={0}
            max={48}
            step={1}
            value={[prefs.blur]}
            onValueChange={(v) => setPref('blur', v[0] ?? 28)}
          />
          <span className="lc-tabular w-9 text-right text-xs text-muted-foreground">{prefs.blur}px</span>
        </Row>
        <Row label="Animation" hint="System respects your reduced-motion preference">
          <ToggleGroup
            type="single"
            value={prefs.motion}
            onValueChange={(v) => v && setPref('motion', v as MotionPref)}
            className="rounded-full bg-[hsl(var(--lc-hover)/0.05)] p-0.5"
          >
            <ToggleGroupItem value="system" className={segItem}>
              System
            </ToggleGroupItem>
            <ToggleGroupItem value="full" className={segItem}>
              Full
            </ToggleGroupItem>
            <ToggleGroupItem value="minimal" className={segItem}>
              Minimal
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row label="Now Playing particles" hint="Subtle ambience; disabled when reduced motion is active">
          <Switch
            aria-label="Now Playing particles"
            checked={prefs.nowPlayingEffects}
            onCheckedChange={(v) => setPref('nowPlayingEffects', v)}
            className="data-[state=checked]:bg-[color:var(--lc-accent)]"
          />
        </Row>
        <Row label="Effects quality" hint="Full uses more graphics resources; Performance is lighter">
          <select aria-label="Effects quality" value={prefs.effectQuality} onChange={(e) => setPref('effectQuality', e.target.value as EffectQuality)} className="lc-glass rounded-lg px-3 py-2 text-sm">
            <option value="performance">Performance</option><option value="full">Full</option>
          </select>
        </Row>
        <Row label="Effect style" hint="Shown in Now Playing while music is playing">
          <select aria-label="Effect style" value={prefs.effectType} onChange={(e) => setPref('effectType', e.target.value as EffectType)} className="lc-glass rounded-lg px-3 py-2 text-sm">
            <option value="particles">Particles</option><option value="rain">Rain</option><option value="snow">Snow</option><option value="aurora">Aurora</option>
          </select>
        </Row>
        <Row label="Compact mode" hint="Denser lists and a slimmer player">
          <Switch
            aria-label="Compact mode"
            checked={prefs.compact}
            onCheckedChange={(v) => setPref('compact', v)}
            className="data-[state=checked]:bg-[color:var(--lc-accent)]"
          />
        </Row>
        <Row label="Collapsed sidebar" hint="Show navigation as icons only">
          <Switch
            aria-label="Collapsed sidebar"
            checked={prefs.sidebarCollapsed}
            onCheckedChange={(v) => setPref('sidebarCollapsed', v)}
            className="data-[state=checked]:bg-[color:var(--lc-accent)]"
          />
        </Row>
        <Row label="Reset appearance" hint="Restore default transparency, blur, motion and layout">
          <button type="button" className={pillBtn} onClick={resetPrefs}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </Row>
      </Section>

      {isDesktop && (
        <Section title="Desktop" description="How Lucent behaves as a Windows app.">
          <Row label="Keep playing in the system tray" hint="Closing the window hides Lucent to the tray. Quit from the tray icon.">
            <Switch
              aria-label="Keep playing in the system tray"
              checked={prefs.closeToTray}
              onCheckedChange={(v) => setPref('closeToTray', v)}
              className="data-[state=checked]:bg-[color:var(--lc-accent)]"
            />
          </Row>
          <Row label="Keyboard media keys" hint="Play/pause, next, previous and stop work even when Lucent isn't focused">
            <Switch
              aria-label="Keyboard media keys"
              checked={prefs.mediaKeys}
              onCheckedChange={(v) => setPref('mediaKeys', v)}
              className="data-[state=checked]:bg-[color:var(--lc-accent)]"
            />
          </Row>
        </Section>
      )}

      <Section title="Equalizer" description="Five-band audio shaping. Boosts automatically add headroom to reduce clipping.">
        <Row label="Equalizer" hint="Saved on this device">
          <Switch aria-label="Enable equalizer" checked={equalizer.enabled} onCheckedChange={(v) => engine.setEqualizer(v, equalizer.bands)} className="data-[state=checked]:bg-[color:var(--lc-accent)]" />
        </Row>
        <div className="flex flex-wrap gap-2 py-3" aria-label="Equalizer presets">
          {Object.entries({ Flat: [0,0,0,0,0], Bass: [6,3,0,0,0], Vocal: [-2,0,4,3,0], Treble: [0,0,0,3,6] }).map(([name, bands]) => <button type="button" className={pillBtn} key={name} onClick={() => engine.setEqualizer(true, bands)}>{name}</button>)}
        </div>
        <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-5">
          {EQ_FREQUENCIES.map((frequency, i) => <label key={frequency} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            <span>{frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`} · {equalizer.bands[i]} dB</span>
            <input className="w-full accent-[color:var(--lc-accent)]" aria-label={`${frequency} Hz equalizer`} type="range" min="-12" max="12" step="1" value={equalizer.bands[i]} onChange={(e) => { const bands = equalizer.bands.slice(); bands[i] = Number(e.target.value); engine.setEqualizer(true, bands) }} />
          </label>)}
        </div>
      </Section>

      <Section title="Keyboard shortcuts">
        <div className="grid grid-cols-1 gap-x-8 py-3 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
              <span className="text-muted-foreground">{s.action}</span>
              <kbd className="lc-hairline shrink-0 rounded-md border px-1.5 py-0.5 font-sans text-[11px] text-foreground/90">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </Section>

      <Section title="About">
        <Row label="Lucent" hint={`Version ${APP_VERSION} · ${isDesktop ? 'Windows edition' : 'Local library edition'}`}>
          <span className="lc-wordmark text-[11px] font-semibold text-muted-foreground">LUCENT</span>
        </Row>
        <Row label="Supported formats" hint="Decoding uses the built-in platform codecs">
          <span className="text-xs text-muted-foreground">
            {AUDIO_EXTENSIONS.filter((e) => e !== 'oga' && e !== 'webm')
              .map((e) => e.toUpperCase())
              .join(' · ')}
          </span>
        </Row>
        <Row label="Privacy" hint="Your music never leaves this device. Nothing is uploaded.">
          <span />
        </Row>
        <Row label="Spotify" hint="Playlist sync is planned for a later release">
          <span className="rounded-full bg-[hsl(var(--lc-hover)/0.07)] px-2.5 py-1 text-[11px] text-muted-foreground">Coming later</span>
        </Row>
      </Section>


      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Remove all music?"
        description={
          isDesktop
            ? `All ${plural(tracks.length, 'song')} will be removed from Lucent. Your music files stay on your PC.`
            : `All ${plural(tracks.length, 'song')} will be deleted from Lucent's storage. Files on your PC are not affected.`
        }
        confirmLabel="Remove all"
        onConfirm={() => void clearLibrary()}
      />
      <ConfirmDialog
        open={confirmMissing}
        onOpenChange={setConfirmMissing}
        title="Remove missing songs?"
        description={`${plural(missingIds.size, 'song')} that can't be found on disk will be removed from your library.`}
        confirmLabel="Remove"
        onConfirm={() => void removeTracks(Array.from(missingIds))}
      />
    </PageShell>
  )
}
