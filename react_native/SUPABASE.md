# Supabase setup (React Native + web desk)

The mobile desk uses the **same Supabase project** as `frontend/`.

## 1. One-time database (if not done yet)

Follow [`../supabase/APPLY.md`](../supabase/APPLY.md):

1. Run migrations `001_init.sql`, `002_seed_admin.sql`, `005_clear_app_data.sql`, `007_login_audit_rpc.sql` in the [Supabase SQL Editor](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/sql/new).
2. Default admin: username **`alatas`**, password **`Alatas@2026`** (see APPLY.md).

## 2. Environment variables

| Web (`frontend/.env`) | React Native (`react_native/.env`) |
|----------------------|-------------------------------------|
| `VITE_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `VITE_USE_SUPABASE=true` | `EXPO_PUBLIC_USE_SUPABASE=true` |

**Easiest:** from `react_native/` run:

```bash
npm run env:sync
```

That copies values from `frontend/.env` into `react_native/.env`.

Get URL and **publishable / anon** key from [Project Settings → API](https://supabase.com/dashboard/project/mgfhomzbykdcuidllysv/settings/api).

## 3. Run the app

```bash
cd react_native
npm install
npm run env:sync
npx expo start
```

After any `.env` change, **restart Expo** (Ctrl+C, then `npx expo start` again).

## 4. Sign in

- **Admin:** `alatas` + password from seed SQL (or your changed password).
- **Employee:** username created under Employees on the web desk + their password.

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Failed to fetch** | `.env` still has `.env.example` placeholders → `npm run env:sync`, restart Expo |
| **Invalid API key** | Use the publishable/anon key from dashboard, not the `service_role` secret |
| **Empty fleet after login** | Migrations not applied → run `001_init.sql` |
| **Wrong password** | Re-run or fix admin in `002_seed_admin.sql` or reset in Supabase Auth |

Project URL: `https://mgfhomzbykdcuidllysv.supabase.co`
