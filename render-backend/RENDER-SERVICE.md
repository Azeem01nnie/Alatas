# Render cloud API (service srv-da8nqr2d0e5s7397d9fg)

**Live URL:** https://alatas-q5ks.onrender.com  
**Health check:** https://alatas-q5ks.onrender.com/api/health

## Dashboard settings (Web Service)

| Setting | Value |
|--------|--------|
| Root Directory | `render-backend` *(optional — repo root also works via Electron redirect)* |
| Build Command | `npm install` |
| Start Command | `node electron/main.cjs` *or* `npm run render:start --prefix render-backend` |
| Node version | `20` (`.node-version` in repo) |

## Env vars on Render

| Key | Value |
|-----|--------|
| `HOST` | `0.0.0.0` |

Render sets `RENDER=true` automatically — that triggers the API redirect in `electron/main.cjs`.

## Local apps — point sync at this URL

**backend/.env**
```env
RENDER_API_URL=https://alatas-q5ks.onrender.com
CLOUD_SYNC_ENABLED=1
```

**frontend/.env**
```env
VITE_RENDER_API_URL=https://alatas-q5ks.onrender.com
VITE_CLOUD_SYNC_ENABLED=true
```

**mobile/.env** (APK / cloud mode)
```env
EXPO_PUBLIC_API_URL=https://alatas-q5ks.onrender.com
```

After changing mobile env, rebuild APK with EAS if the URL changed.
