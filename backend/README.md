# Alatas Backend

API server for Alatas Car Rental Services.

## Run

```bash
cd backend
npm install
npm run dev
```

Default URL: `http://localhost:4000`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/vehicles` | List vehicles |
| PUT | `/api/vehicles` | Replace vehicle list |
| GET | `/api/rentals` | List rental history |
| POST | `/api/rentals` | Add a rental record |
| PUT | `/api/rentals` | Replace rental list |

Data is stored in SQLite:

- Dev (API only): `backend/sqlite/alatas.db`
- Electron: `%APPDATA%/alatas/sqlite/alatas.db` (via `ALATAS_DATA_DIR`)

When `SERVE_FRONTEND=1` and `FRONTEND_DIST` is set, this server also hosts the built React app (used by the packaged Electron app).
