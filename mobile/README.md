# Alatas Mobile (Expo)

React Native app that mirrors the web/desktop fleet desk. **Supabase** is the shared backend with [alatas-gamma.vercel.app](https://alatas-gamma.vercel.app).

## Setup

1. Copy `.env.example` → `.env` and set:

```env
EXPO_PUBLIC_USE_SUPABASE=true
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

2. Install and run:

```bash
cd mobile
npm install
npx expo start
```

3. Sign in with the same Supabase accounts as the website (`username` → `username@alatas.local`).

## EAS builds

Set secrets in the Expo dashboard (or pass env in `eas.json`):

- `EXPO_PUBLIC_USE_SUPABASE=true`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

```bash
npm run eas:build:android
```

Do **not** leave the anon key empty in production builds.

## Feature map (desk parity)

| Desk | Mobile |
|------|--------|
| Dashboard + approvals | Dashboard → Rental detail |
| Calendar | Calendar tab |
| Rent Car | Rent tab (multi-step) |
| Manage Vehicle | Fleet tab (admin) |
| Rental History | History tab |
| Employees / Reports / Settings | More tab (admin) |
| Employee photos | Camera tab |

## Notes

- OR/CR on phone: image upload + manual fields (full PDF OCR remains on the web desk).
- Offline queue still flushes pending rentals and car photos when back online.
- Render REST is no longer required when Supabase env is set.
