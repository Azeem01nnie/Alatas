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

## 2c. Login audit table (optional)

1. Open SQL Editor
2. Paste and **Run** [`supabase/migrations/006_audit_logs.sql`](migrations/006_audit_logs.sql)

Login audit also stores in `app_settings` (`login_audit`) so Settings works even before this migration.

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
