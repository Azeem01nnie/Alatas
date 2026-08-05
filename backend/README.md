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

Data is stored in `backend/data/*.json`.
