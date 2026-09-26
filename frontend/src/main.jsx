import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { VehicleProvider } from './context/VehicleContext.jsx'

// Force new SW so OR/CR scanner (same-origin Tesseract) is not stuck behind a stale precache
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
  onRegisteredSW(_url, registration) {
    registration?.update?.()
    // Bust stale caches after scanner asset path change (2026-09-27)
    try {
      const key = 'alatas_sw_bust_orcr_v2'
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1')
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
          registration?.unregister?.().finally(() => window.location.reload())
        })
      }
    } catch {
      /* ignore */
    }
  },
})

try {
  const raw = localStorage.getItem('alatas-admin-system-settings')
  const theme = raw ? JSON.parse(raw).theme : 'light'
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme)
  } else if (theme === 'dim') {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VehicleProvider>
      <App />
    </VehicleProvider>
  </StrictMode>,
)
