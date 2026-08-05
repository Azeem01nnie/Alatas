import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { VehicleProvider } from './context/VehicleContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VehicleProvider>
      <App />
    </VehicleProvider>
  </StrictMode>,
)
