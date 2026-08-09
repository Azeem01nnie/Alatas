const fs = require('fs')
const path = require('path')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // Skip junctions/symlinks (e.g. accidental backend/node_modules/alatas → repo root)
    if (entry.isSymbolicLink()) continue

    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)

    let stat
    try {
      stat = fs.lstatSync(from)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      copyDir(from, to)
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to)
    }
  }
}

/**
 * electron-builder skips gitignored paths (backend/node_modules).
 * Copy production modules after pack so Express + SQLite can start.
 */
exports.default = async function afterPack(context) {
  const resourcesDir = path.join(context.appOutDir, 'resources')
  const backendDest = path.join(resourcesDir, 'backend')
  const modulesSrc = path.join(__dirname, '..', 'backend', 'node_modules')
  const modulesDest = path.join(backendDest, 'node_modules')

  if (!fs.existsSync(modulesSrc)) {
    throw new Error(
      `Backend node_modules not found at ${modulesSrc}. Run npm install --prefix backend`,
    )
  }

  fs.mkdirSync(backendDest, { recursive: true })
  fs.rmSync(modulesDest, { recursive: true, force: true })
  copyDir(modulesSrc, modulesDest)

  const pkgSrc = path.join(__dirname, '..', 'backend', 'package.json')
  const pkgDest = path.join(backendDest, 'package.json')
  if (fs.existsSync(pkgSrc)) {
    fs.copyFileSync(pkgSrc, pkgDest)
  }

  const hasSqlite = fs.existsSync(path.join(modulesDest, 'better-sqlite3'))
  const hasExpress = fs.existsSync(path.join(modulesDest, 'express'))
  if (!hasSqlite || !hasExpress) {
    throw new Error(
      `afterPack incomplete (better-sqlite3=${hasSqlite}, express=${hasExpress})`,
    )
  }

  console.log(`[afterPack] Copied backend node_modules → ${modulesDest}`)
}
