import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import '../../frontend/theme.css'
import './theme'
import './guards'
import App from '../../frontend/App'

/**
 * Desktop entry point. Replaces the Retool-hosted frontend/index.tsx (auth gate, iframe navigation
 * sync, preview tooling) with a plain mount. HashRouter keeps deep links working when the webview
 * reloads, since the app is served from Tauri's custom protocol rather than a web server.
 */
const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
