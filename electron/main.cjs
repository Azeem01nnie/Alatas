// On Render the service may start from repo root via `node electron/main.cjs`.
// Redirect to the cloud API in render-backend/ instead of loading Electron.
if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
  const { spawnSync } = require('child_process')
  const path = require('path')
  const result = spawnSync(process.execPath, ['scripts/render-start.js'], {
    cwd: path.join(__dirname, '..', 'render-backend'),
    stdio: 'inherit',
    env: process.env,
  })
  process.exit(result.status ?? 1)
}

const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

const isDev = !app.isPackaged

let mainWindow = null
let staticServer = null
let staticPort = 0

function logLine(message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

function writeCrashLog(error) {
  try {
    const file = path.join(app.getPath('userData'), 'launch-error.log')
    fs.writeFileSync(file, String(error?.stack || error), 'utf8')
    return file
  } catch {
    return null
  }
}

function resolvePaths() {
  if (isDev) {
    return {
      frontendDist: path.join(__dirname, '..', 'frontend', 'dist'),
      iconPath: path.join(__dirname, '..', 'frontend', 'src', 'assets', 'logonobg.png'),
    }
  }
  return {
    frontendDist: path.join(process.resourcesPath, 'frontend-dist'),
    iconPath: path.join(process.resourcesPath, 'icon.png'),
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  }
  return map[ext] || 'application/octet-stream'
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        let rel = urlPath === '/' ? '/index.html' : urlPath
        let filePath = path.normalize(path.join(rootDir, rel))
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(rootDir, 'index.html')
        }
        const body = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        res.end(body)
      } catch (err) {
        res.writeHead(500)
        res.end(String(err?.message || err))
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      staticPort = addr.port
      staticServer = server
      logLine(`Static UI server on http://127.0.0.1:${staticPort} (no SQLite/Express)`)
      resolve(staticPort)
    })
    server.on('error', reject)
  })
}

function createWindow() {
  const { iconPath } = resolvePaths()
  const winOptions = {
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }

  if (iconPath && fs.existsSync(iconPath)) {
    winOptions.icon = iconPath
  }

  mainWindow = new BrowserWindow(winOptions)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.ALATAS_DEV_URL || 'http://localhost:5173')
    if (process.env.ALATAS_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${staticPort}`)
  }
}

async function bootstrap() {
  try {
    if (!isDev) {
      const { frontendDist } = resolvePaths()
      if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
        throw new Error(`Frontend build missing: ${frontendDist}`)
      }
      await startStaticServer(frontendDist)
    }
    createWindow()
  } catch (err) {
    const logFile = writeCrashLog(err)
    logLine(`Startup failed: ${err}`)
    dialog.showErrorBox(
      'Alatas failed to start',
      `${err?.message || err}\n\n${logFile ? `Details saved to:\n${logFile}` : ''}`,
    )
    app.quit()
  }
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
})
