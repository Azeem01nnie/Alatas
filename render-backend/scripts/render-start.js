/**
 * Render start entry — no bash required (avoids CRLF / chmod issues on Windows repos).
 */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
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

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
