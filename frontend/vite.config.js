import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths for Electron / static hosting from Express
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
