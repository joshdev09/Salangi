import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Auto-update: silently reloads when a new SW version is available
registerSW({
  onNeedRefresh() {
    // A new version is available — the SW will update on next navigation
    console.log('[PWA] New content available, will update on next reload.')
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)