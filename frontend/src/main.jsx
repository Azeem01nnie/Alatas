import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { VehicleProvider } from './context/VehicleContext.jsx'

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
