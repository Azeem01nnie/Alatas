# Supabase setup (React Native + web desk)

The mobile desk uses the **same Supabase project** as `frontend/`.

## 1. One-time database (if not done yet)

Follow [`../supabase/APPLY.md`](../supabase/APPLY.md):

1. Run migrations `001_init.sql`, `002_seed_admin.sql`, `005_clear_app_data.sql`, `007_login_audit_rpc.sql` in the [Supabase SQL Editor](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/sql/new).
2. Default admin: username **`alatas`**, password **`Alatas@2026`** (see APPLY.md).

## 2. Environment variables

All credentials live in **`env/.env`** at the repo root (template: `env/.env.example`).
The mobile app reads it directly and reuses `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
unless you set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` explicitly.

Get URL and **publishable / anon** key from [Project Settings → API](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/settings/api).

## 3. Run the app

```bash
cd react_native
npm install
npx expo start
```

After any `env/.env` change, **restart Expo** (Ctrl+C, then `npx expo start` again).

## 4. Sign in

- **Admin:** `alatas` + password from seed SQL (or your changed password).
- **Employee:** username created under Employees on the web desk + their password.

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Failed to fetch** | `env/.env` still has `.env.example` placeholders → fill in real values, restart Expo |
| **Invalid API key** | Use the publishable/anon key from dashboard, not the `service_role` secret |
| **Empty fleet after login** | Migrations not applied → run `001_init.sql` |
| **Wrong password** | Re-run or fix admin in `002_seed_admin.sql` or reset in Supabase Auth |

Project URL: `https://mgfhomzbykdcuidllysv.supabase.co`
