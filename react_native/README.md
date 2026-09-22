# Alatas React Native (fleet desk)

Native Expo twin of the Alatas web fleet desk (`frontend/`). Same Supabase backend, auth, and role-gated modules.

## Setup

```bash
cd react_native
npm install
npm run env:sync    # copies Supabase vars from frontend/.env
npx expo start
```

Full Supabase steps (migrations, admin account, troubleshooting): **[SUPABASE.md](./SUPABASE.md)**.

Use the **same** Supabase URL and anon key as `frontend/.env`. If you copied `.env.example` without editing, sign-in fails with **Failed to fetch** — run `npm run env:sync` and **restart Expo** (Ctrl+C, then `npx expo start` again).

## Modules (match web desk)

| Screen | Admin | Employee |
|--------|-------|----------|
| Login | yes | yes |
| Dashboard (+ pending approvals) | approve / complete | view |
| Calendar | yes | yes |
| Rent Car (7-step) | auto-approve | submits pending |
| Manage Vehicle | yes | hidden |
| Employees | yes | hidden |
| Reports | yes | hidden |
| History → Transaction | yes | yes |
| Settings | wipe / profile | theme + sign out |

## Stack

- Expo ~54, React Navigation (drawer + stack)
- `@supabase/supabase-js` with AsyncStorage session
- `expo-image-picker` for rental / OR photos

## Notes

- No WebAuthn / fingerprint (same as current PWA).
- Admin username is typically `alatas` (`alatas@alatas.local`).
- Employees sign in with their desk username + password created in Employees.
