# Apply Supabase schema (required once)

Your desk app is wired to:

- URL: `https://mgfhomzbykdcuidllysv.supabase.co`
- Publishable key in `frontend/.env`

Express + SQLite are no longer started by `npm start` / Electron.

## 1. Create tables (you run this once)

1. Open [SQL Editor](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/sql/new)
2. Paste the full contents of [`supabase/migrations/001_init.sql`](../supabase/migrations/001_init.sql)
3. Click **Run**

## 2. Create the admin account (SQL — no Auth “Add user” UI)

1. Open [SQL Editor](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/sql/new)
2. Paste and **Run** [`supabase/migrations/002_seed_admin.sql`](migrations/002_seed_admin.sql)

That inserts into `auth.users` + `public.employees` for:

| Field | Value |
|-------|--------|
| Username | `alatas` |
| Password | `Alatas@2026` |
| Email (internal) | `alatas@alatas.local` |

You do **not** need Authentication → Add user.

## 2b. Clear-data RPC (required for Settings → Clear data)

1. Open SQL Editor again
2. Paste and **Run** [`supabase/migrations/005_clear_app_data.sql`](migrations/005_clear_app_data.sql)

This lets admins wipe fleet/rental/staff data from Settings while keeping the admin login.
If the RPC is missing or fails, the app still clears vehicles/rentals via a client fallback.

## 2c. Login audit (required for failed logins from other devices)

1. Open SQL Editor
2. Paste and **Run** [`supabase/migrations/007_login_audit_rpc.sql`](migrations/007_login_audit_rpc.sql)

This adds `record_login_audit` so wrong-password attempts (no session) still appear in Settings → Login audit trail.
Optional earlier file [`006_audit_logs.sql`](migrations/006_audit_logs.sql) is covered by 007.

## 2d. OR/CR AI scan (Gemini Edge Function)

Manage Vehicle → Upload CR/OR prefers Gemini vision via Edge Function `scan-orcr`, then falls back to local Tesseract if AI is unavailable.

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Deploy the function and set the secret (CLI, from repo root):

```bash
npx supabase login
npx supabase link --project-ref mgfhomzbykdcuidllysv
npx supabase functions deploy scan-orcr
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY_HERE
```

Or in the Dashboard (no CLI):

1. Open [Edge Functions](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/functions) → deploy/create `scan-orcr` from `supabase/functions/scan-orcr`
2. Open [Function secrets](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/settings/functions) → add:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini key

Optional model override (default `gemini-2.0-flash`):

```bash
npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash
```

Do **not** put `GEMINI_API_KEY` in `frontend/.env` — the browser only calls `supabase.functions.invoke('scan-orcr')`.

## 2e. Vehicle gallery + insurance columns

Run [`supabase/migrations/008_vehicle_gallery_insurance.sql`](migrations/008_vehicle_gallery_insurance.sql) in the SQL Editor so Manage Vehicle can store multiple display photos and insurance photos in dedicated jsonb columns.

Until that migration is applied, multi display photos still persist: they upload to Storage and the URL list is packed into the legacy `image` text column. Insurance photos need migration 008.

Owners are synced to Supabase `app_settings` (`owners`) so Vehicle Reports keeps them after refresh.

## 3. Run the desk app

```bash
cd frontend
npm install
cd ..
npm start
```

Or Electron: `npm run electron:dev`

## 4. What was removed from the default path

| Before | After |
|--------|--------|
| Local Express + SQLite | Supabase Postgres |
| Render sync queue | Direct Supabase reads/writes |
| Electron spawns `backend/` | Electron serves static UI only (prod) / Vite (dev) |

Folders `backend/` and `render-backend/` remain in the repo for now (legacy / migration source) but are **not** used by `npm start`.
