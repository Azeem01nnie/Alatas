# Alatas Car Rental Services

```
Alatas/
├── frontend/          # React customer panel + admin
├── backend/           # Express API + SQLite
├── electron/          # Desktop shell (main + preload)
├── start.bat          # Browser mode (Windows)
├── start-electron.bat # Electron dev (Windows)
└── package.json
```

## Browser mode (recommended for web testing)

Double-click **`start.bat`**, or:

```bash
npm run install:all
npm start
```

Opens **http://localhost:5173** (API on **http://127.0.0.1:4000**).

## Electron desktop (Windows)

### Dev window

```bash
npm run install:all
npm run electron:dev
```

Or double-click **`start-electron.bat`**.

Electron starts the backend itself, then loads the Vite UI.

### Native module rebuild (if SQLite fails in Electron)

`better-sqlite3` must match Electron’s Node ABI:

```bash
npm run rebuild:native
```

### Windows installer

```bash
npm run electron:build
```

Output installer: `release/Alatas Car Rental-Setup-1.0.0.exe`

Packaged app data (SQLite) lives under the OS user data folder, not inside the install directory.

## Separate commands

```bash
npm run dev:app    # frontend only
npm run dev:api    # backend only
```
