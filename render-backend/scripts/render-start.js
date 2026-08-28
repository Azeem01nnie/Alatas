/**
 * Render start entry — sets data dir then loads the API (single process).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function resolveDataDir() {
  const preferred = process.env.ALATAS_DATA_DIR
  if (preferred && fs.existsSync(preferred)) {
    return path.resolve(preferred)
  }
  const fallback = path.join(root, 'sqlite')
  console.log(
    preferred
      ? `[render-start] ${preferred} not mounted — using ${fallback}`
      : `[render-start] using ${fallback}`,
  )
  return fallback
}

const dataDir = resolveDataDir()
fs.mkdirSync(dataDir, { recursive: true })
process.env.ALATAS_DATA_DIR = dataDir

await import('../src/server.js')
