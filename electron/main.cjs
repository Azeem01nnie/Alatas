const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const net = require('net')
const { spawn } = require('child_process')

const DEFAULT_PORT = Number(process.env.ALATAS_PORT || 4000)
const isDev = !app.isPackaged

let mainWindow = null
let backendProcess = null
let backendPort = DEFAULT_PORT
const backendLogs = []

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  backendLogs.push(line)
  if (backendLogs.length > 200) backendLogs.shift()
  console.log(line)
}

function writeCrashLog(error) {
  try {
    const file = path.join(app.getPath('userData'), 'launch-error.log')
    const body = [
      String(error?.stack || error),
      '',
      '--- backend log ---',
      ...backendLogs,
    ].join('\n')
    fs.writeFileSync(file, body, 'utf8')
    return file
  } catch {
    return null
  }
}

function resolveBackendPaths() {
  if (isDev) {
    return {
      backendRoot: path.join(__dirname, '..', 'backend'),
      serverEntry: path.join(__dirname, '..', 'backend', 'src', 'server.js'),
      frontendDist: path.join(__dirname, '..', 'frontend', 'dist'),
      iconPath: path.join(__dirname, '..', 'frontend', 'src', 'assets', 'logonobg.png'),
    }
  }

  return {
    backendRoot: path.join(process.resourcesPath, 'backend'),
    serverEntry: path.join(process.resourcesPath, 'backend', 'src', 'server.js'),
    frontendDist: path.join(process.resourcesPath, 'frontend-dist'),
    iconPath: path.join(process.resourcesPath, 'icon.png'),
  }
}

function getFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => {
      // try next port
      getFreePort(startPort + 1).then(resolve, reject)
    })
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function waitForHealth(port, timeoutMs = 30000) {
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const tick = () => {
      if (backendProcess && backendProcess.exitCode != null) {
        reject(
          new Error(
            `Backend exited early (code ${backendProcess.exitCode}). Check launch-error.log`,
          ),
        )
        return
      }

      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        if (res.statusCode === 200) {
          resolve()
          return
        }
        retry()
      })

      req.on('error', retry)
      req.setTimeout(1500, () => {
        req.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Backend health check timed out on port ${port}`))
        return
      }
      setTimeout(tick, 300)
    }

    tick()
  })
}

async function startBackend() {
  const { backendRoot, serverEntry, frontendDist } = resolveBackendPaths()
  const dataDir = path.join(app.getPath('userData'), 'sqlite')

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Backend entry missing: ${serverEntry}`)
  }

  const modulesDir = path.join(backendRoot, 'node_modules')
  if (!fs.existsSync(modulesDir)) {
    throw new Error(
      `Backend dependencies missing: ${modulesDir}\nRebuild with: npm run electron:build`,
    )
  }

  backendPort = await getFreePort(DEFAULT_PORT)
  fs.mkdirSync(dataDir, { recursive: true })

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(backendPort),
    ALATAS_DATA_DIR: dataDir,
    SERVE_FRONTEND: isDev ? '0' : '1',
    FRONTEND_DIST: frontendDist,
  }

  logLine(`Starting backend: ${serverEntry}`)
  logLine(`cwd=${backendRoot} port=${backendPort}`)

  backendProcess = spawn(process.execPath, [serverEntry], {
    cwd: backendRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout?.on('data', (chunk) => {
    logLine(`[backend] ${String(chunk).trim()}`)
  })
  backendProcess.stderr?.on('data', (chunk) => {
    logLine(`[backend:err] ${String(chunk).trim()}`)
  })
  backendProcess.on('exit', (code, signal) => {
    logLine(`[backend] exited code=${code} signal=${signal}`)
    backendProcess = null
  })

  await waitForHealth(backendPort)
}

function createWindow() {
  const { iconPath } = resolveBackendPaths()
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
    mainWindow.loadURL(`http://127.0.0.1:${backendPort}`)
  }
}

async function bootstrap() {
  try {
    await startBackend()
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
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
    backendProcess = null
  }
})
