import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The desktop app renders the exact same React code as the web prototype (../frontend).
 * - Every runtime dependency is resolved from desktop/node_modules (dedupe), so ../frontend needs no install.
 * - shadcn components are vendored in src/vendor/shadcn because frontend/lib/shadcn is not in git.
 */
const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(desktopDir, '../frontend')
const vendorShadcnDir = path.resolve(desktopDir, 'src/vendor/shadcn')
const pkg = JSON.parse(readFileSync(path.join(desktopDir, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}
const host = process.env['TAURI_DEV_HOST']
const debug = !!process.env['TAURI_ENV_DEBUG']

function vendoredShadcn(): Plugin {
  return {
    name: 'lucent:vendored-shadcn',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      const match = /(?:^|\/)lib\/shadcn\/([\w-]+)$/.exec(source)
      if (!match) return null
      for (const ext of ['.tsx', '.ts']) {
        const file = path.join(vendorShadcnDir, `${match[1]}${ext}`)
        if (existsSync(file)) return file
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [vendoredShadcn(), react()],
  clearScreen: false,
  resolve: {
    dedupe: Object.keys(pkg.dependencies),
  },
  server: {
    port: 1420,
    strictPort: true,
    ...(host ? { host, hmr: { protocol: 'ws', host, port: 1421 } } : {}),
    fs: { allow: [desktopDir, frontendDir] },
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WebView2 is evergreen Chromium
    target: 'chrome120',
    minify: !debug,
    sourcemap: debug,
    outDir: 'dist',
    emptyOutDir: true,
  },
})
