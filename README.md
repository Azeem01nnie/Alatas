# Alatas Car Rental Services

Web and Windows desktop app for Alatas Car Rental — customer rental flow and admin fleet desk.

```
Alatas/
├── frontend/          # React (Vite) — customer panel + admin
├── backend/           # Express API + SQLite
├── electron/          # Desktop shell (main + preload)
├── start.bat          # Browser mode (Windows)
├── start-electron.bat # Electron dev (Windows)
└── package.json
```

## Requirements

- Node.js 20+ recommended
- Windows for Electron packaging (`electron:build`)

## Install

```bash
npm run install:all
```

## Browser (web app)

Double-click **`start.bat`**, or:

```bash
npm start
```

- UI: **http://localhost:5173**
- API: **http://127.0.0.1:4000**

Separate processes:

```bash
npm run dev:app    # frontend only
npm run dev:api    # backend only
```

### Admin

Open the admin panel from the app UI. Default credentials:

- Username: `alatas`
- Password: `Alatas@2026`

Settings include profile, appearance, notifications, backup/import, and **Clear cache** (temporary browser cache only — fleet data is kept).

## Electron desktop (Windows)

### Dev window

```bash
npm run electron:dev
```

Or double-click **`start-electron.bat`**.

Electron starts the backend, then loads the Vite UI at `http://127.0.0.1:5173`.

### Native module rebuild

`better-sqlite3` must match Electron’s Node ABI:

```bash
npm run rebuild:native
```

### Windows installer

```bash
npm run electron:build
```

Installer output:

`release/Alatas Car Rental-Setup-<version>.exe`

Packaged SQLite data is stored under the OS user data folder (`%APPDATA%/alatas`), not inside the install directory.

## Data

| Store | Location |
|--------|----------|
| Vehicles & rentals | SQLite via backend API |
| Owners, archives, reports, admin profile/settings | Browser / Electron `localStorage` |

Use **Settings → Download data** for a full backup, and **Import / migrate** to restore.

## Notes

- This repo is **web + Electron only** (no mobile app).
- If the API is down, the admin UI will not treat an empty fleet as real data (avoids wiping owners or overwriting SQLite).
