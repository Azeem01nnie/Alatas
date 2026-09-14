# Deploy Alatas frontend (PWA) to Vercel

Electron desktop stays separate. This only hosts the web/PWA.

## 0. Push code to GitHub first

Your Vercel project reads from GitHub. Commit and push the latest `frontend` + `supabase` work, then continue.

```bash
git add frontend supabase package.json electron electron-builder.yml
git status
# commit when you are ready, then:
git push origin main
```

## A. Prepare (already in repo)

- App folder: `frontend/`
- SPA config: `frontend/vercel.json`
- Build: `npm run build` → `frontend/dist`

## B. Deploy via Vercel website (recommended)

1. Open [https://vercel.com](https://vercel.com) → sign in with **GitHub**.
2. **Add New… → Project** → import **Azeem01nnie/Alatas**.
3. Configure:
   - **Root Directory:** `frontend` (Edit → select `frontend`)
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. **Environment Variables** (add for Production and Preview):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://mgfhomzbykdcuidllysv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your publishable key (`sb_publishable_…`) from `frontend/.env` |
| `VITE_USE_SUPABASE` | `true` |
| `VITE_CLOUD_SYNC_ENABLED` | `false` |

5. Click **Deploy**.
6. Copy the URL (e.g. `https://alatas-xxx.vercel.app`).
7. Phone: open URL → Install / Add to Home Screen.

If login fails after deploy, check env vars and **Redeploy**.

## C. Cloudflare?

Not required. Use **Vercel only** for now. Cloudflare Pages is an alternative host; don’t run two hosts for the same app unless you have a reason.

## D. Electron?

Unchanged. Desk = Electron, phones = Vercel PWA, both → Supabase.
