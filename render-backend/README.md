# Alatas Render Backend (Option C — cloud master)

Express + SQLite API intended for deployment on [Render](https://render.com) with a persistent disk and Litestream replication to Cloudflare R2.

This folder is **standalone** — it does not depend on the desktop `backend/` package. The phone app is **not wired** to this API yet.

## What it does

- Cloud master for vehicles and rentals when online
- Sync pull/push endpoints for desktop and (future) mobile clients
- Pending rental workflow: field submissions stay `pending` until an admin accepts or rejects on desktop
- Binds `0.0.0.0` so Render can route traffic to the service

## Local smoke test

```bash
cd render-backend
npm install
set ALATAS_DATA_DIR=%CD%\sqlite
npm run dev
```

Health check: `http://127.0.0.1:4000/api/health`

## Render deploy (when ready)

**Option A — Blueprint (recommended):** In Render → **New** → **Blueprint** → connect this repo. It reads `/render.yaml` at the repo root and sets `rootDir: render-backend` automatically.

**Option B — Manual Web Service:**

1. Create a **Web Service** pointing at this repo
2. **Root Directory:** `render-backend` ← required (repo root is the Electron desktop app)
3. Build command: `npm install`
4. Start command: `npm run render:start`
5. *(Optional, paid plan)* Add a persistent disk mounted at `/var/data` and set `ALATAS_DATA_DIR=/var/data`
6. Set environment variables:
   - `PORT` (Render sets this automatically)
   - `HOST=0.0.0.0`
   - `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
6. After deploy, set on the **desktop frontend** (not phone yet):
   - `VITE_RENDER_API_URL=https://your-service.onrender.com`
   - `VITE_CLOUD_SYNC_ENABLED=true`
7. Optionally set on the **local desktop backend** to flush its queue:
   - `RENDER_API_URL=https://your-service.onrender.com`
   - `CLOUD_SYNC_ENABLED=1`

## Connect desktop (later — disabled by default)

Desktop keeps working offline via the embedded local API + SQLite. Cloud sync only runs when you explicitly enable the env vars above.

Phone / React Native: connection helpers exist in `frontend/src/api/cloudSync.js` but are **not connected** in this phase.

## API highlights

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/system/status` | Mode, queue counts |
| GET | `/api/pending-rentals` | List pending approvals |
| POST | `/api/pending-rentals/:id/accept` | Accept pending rental |
| POST | `/api/pending-rentals/:id/reject` | Reject with optional reason |
| POST | `/api/rentals/pending` | Submit field rental (pending) |
| GET | `/api/sync/pull` | Pull changes since timestamp |
| POST | `/api/sync/push` | Push client changes (LWW) |
| GET | `/api/employees` | List employee accounts |
| POST | `/api/employees` | Create employee |
| PATCH | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Remove employee |
| POST | `/api/employees/auth` | Employee mobile login |
| GET | `/api/sync/queue` | Inspect outbound sync queue |

## Security note

Add authentication (API key or JWT) before exposing this service publicly. The current build is intended for private fleet use during integration.
