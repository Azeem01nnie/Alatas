# Alatas PWA (phone) + Desktop Electron

Same app: `frontend/`  
Same data: Supabase  

| Client | How to use |
|--------|------------|
| Desktop | Electron (`npm run electron:dev` / installer) |
| Phone | Open the web URL → Install / Add to Home Screen |

React Native (`mobile/`) is unchanged and not required for this.

---

## 1. Run on your PC (and phone on the same Wi‑Fi)

In the project root:

```bash
npm start
```

Vite prints a **Network** URL, for example:

`http://192.168.x.x:5173`

On your phone (same Wi‑Fi), open that URL in **Chrome** (Android) or **Safari** (iPhone).

Sign in with the same admin/employee accounts as the desk.

---

## 2. Install as an app (PWA)

### Android (Chrome)
1. Open the Network URL above  
2. Menu **⋮** → **Install app** / **Add to Home screen**  
3. Confirm — Alatas appears like a normal app icon  

### iPhone (Safari)
1. Open the URL in **Safari** (not Chrome)  
2. Tap **Share** → **Add to Home Screen**  
3. Tap **Add**  

> Real “Install app” on the public internet needs **HTTPS**.  
> For production, deploy `frontend` (see below). LAN `http://192.168…` works for testing; iOS still allows Add to Home Screen.

---

## 3. Production host (recommended for staff phones)

Build:

```bash
npm run build --prefix frontend
```

Deploy the `frontend/dist` folder to any static host with HTTPS, for example:
- Vercel / Netlify / Cloudflare Pages / Firebase Hosting  

Set the same env as local (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_SUPABASE=true`) in the host’s environment, then rebuild.

Staff open `https://your-domain…` → Install.

---

## 4. Desktop Electron (still works)

```bash
npm run electron:dev
```

Or build the Windows installer:

```bash
npm run electron:build
```

Electron packs the same `frontend` build. No separate UI.

---

## Checklist

1. [ ] `npm start` — PC browser works  
2. [ ] Phone on Wi‑Fi opens Network URL and can sign in  
3. [ ] Install / Add to Home Screen  
4. [ ] (Later) Deploy `frontend/dist` on HTTPS for permanent staff link  
