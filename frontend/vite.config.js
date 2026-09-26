import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

/** Copy Tesseract worker + wasm into public/ so Workers are same-origin on Vercel. */
function copyTesseractAssets() {
  const copy = () => {
    const destDir = resolve(rootDir, 'public/tesseract')
    mkdirSync(destDir, { recursive: true })
    const files = [
      [
        resolve(rootDir, 'node_modules/tesseract.js/dist/worker.min.js'),
        resolve(destDir, 'worker.min.js'),
      ],
      [
        resolve(
          rootDir,
          'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
        ),
        resolve(destDir, 'tesseract-core-simd-lstm.wasm.js'),
      ],
      [
        resolve(
          rootDir,
          'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm',
        ),
        resolve(destDir, 'tesseract-core-simd-lstm.wasm'),
      ],
    ]
    for (const [from, to] of files) {
      if (!existsSync(from)) {
        console.warn(`[copy-tesseract] missing ${from}`)
        continue
      }
      copyFileSync(from, to)
    }
  }

  return {
    name: 'copy-tesseract-assets',
    buildStart() {
      copy()
    },
    configureServer() {
      copy()
    },
  }
}

// Electron static server and hosted PWA both work with absolute asset paths.
export default defineConfig({
  plugins: [
    copyTesseractAssets(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.jpg', 'pwa-icon.png'],
      manifest: {
        name: 'Alatas Car Rental',
        short_name: 'Alatas',
        description: 'Alatas fleet desk — rentals, approvals, and history',
        theme_color: '#b32025',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App shell + assets; API goes to Supabase (network only)
        // Tesseract WASM is large — load on demand, do not precache
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}'],
        globIgnores: ['**/tesseract/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tessdata-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/tesseract\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-assets',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
})
