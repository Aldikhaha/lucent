import { Navigate, Route, Routes } from 'react-router-dom'
import './appTheme.css'
import './lucent.css'
import { TooltipProvider } from './lib/shadcn/tooltip'
import { PrefsProvider } from './state/PrefsContext'
import { LibraryProvider } from './state/LibraryContext'
import { PlayerProvider } from './state/PlayerContext'
import { UiProvider } from './state/UiContext'
import { AppShell } from './components/lucent/AppShell'
import Home from './pages/Home'
import Songs from './pages/Songs'
import { AlbumDetailPage, AlbumsPage } from './pages/Albums'
import { FolderDetailPage, FoldersPage } from './pages/Folders'
import Recent from './pages/Recent'
import Search from './pages/Search'
import Settings from './pages/Settings'

export default function App() {
  return (
    <PrefsProvider>
      <LibraryProvider>
        <PlayerProvider>
          <UiProvider>
            <TooltipProvider delayDuration={500} skipDelayDuration={200}>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/songs" element={<Songs />} />
                  <Route path="/albums" element={<AlbumsPage />} />
                  <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
                  <Route path="/folders" element={<FoldersPage />} />
                  <Route path="/folders/:folderId" element={<FolderDetailPage />} />
                  <Route path="/recent" element={<Recent />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </TooltipProvider>
          </UiProvider>
        </PlayerProvider>
      </LibraryProvider>
    </PrefsProvider>
  )
}
