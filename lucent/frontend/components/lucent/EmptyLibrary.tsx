import { FilePlus2, FolderPlus } from 'lucide-react'
import { useLibrary } from '../../state/LibraryContext'
import { AUDIO_EXTENSIONS } from '../../core/importer'

/** First-run invitation to bring music in. */
export function EmptyLibrary({ compact = false }: { compact?: boolean }) {
  const { pickFiles, pickFolder } = useLibrary()
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center px-6 py-16 text-center'
          : 'lc-glass mx-auto flex max-w-[560px] flex-col items-center rounded-[22px] px-10 py-14 text-center'
      }
    >
      <div className="relative mb-6 h-16 w-16">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-90 shadow-[inset_0_1px_2px_hsl(0_0%_100%/0.6),0_12px_30px_-10px_hsl(var(--lc-shadow)/0.6)]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, hsl(0 0% 100% / 0.95), hsl(var(--accent-h) var(--accent-s) 72% / 0.85) 45%, hsl(var(--accent-h) var(--accent-s) 28%) 100%)',
          }}
        />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">Bring your music in</h2>
      <p className="mt-2 max-w-[380px] text-[13px] leading-relaxed text-muted-foreground">
        Import a folder from your PC and Lucent will read every song inside it, including subfolders, with titles,
        artists, albums and artwork.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={pickFolder}
          className="lc-focus flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-[13px] font-medium text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <FolderPlus className="h-4 w-4" />
          Import folder
        </button>
        <button
          type="button"
          onClick={pickFiles}
          className="lc-focus lc-glass flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--lc-hover)/0.08)]"
        >
          <FilePlus2 className="h-4 w-4" />
          Choose files
        </button>
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground/80">
        Or drag files and folders anywhere into the window ·{' '}
        {AUDIO_EXTENSIONS.filter((e) => e !== 'oga' && e !== 'webm')
          .map((e) => e.toUpperCase())
          .join(', ')}
      </p>
    </div>
  )
}
