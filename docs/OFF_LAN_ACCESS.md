# Using Vendorly away from home (off LAN / cellular)

Vendorly splits traffic between **Supabase** (cloud) and an optional **NestJS backend** (POS, admin AI, market photo proxy). Most shopper and vendor marketplace flows use Supabase only and work anywhere with internet.

## What works without your home network

| Feature | Needs backend? | Works on cellular? |
|---------|----------------|--------------------|
| Sign up / sign in / OAuth | No (Supabase) | Yes |
| Discover, map, events, feed | No (Supabase) | Yes |
| Reservations, orders, products | No (Supabase) | Yes |
| Vendor dashboard (non-POS) | No (Supabase) | Yes |
| Admin vendor/event moderation (UI) | No (Supabase) | Yes |
| Market banner photos (`/public/markets/…`) | Yes (API proxy) | Only if `*_API_URL` points to a public HTTPS API |
| Square POS connect/sync | Yes | Only with public HTTPS API + `POS_PROVIDER_BASE_URL` |
| Admin AI agent buttons | Yes | Only with public HTTPS API |
| POS card-sales analytics | Yes | Only with public HTTPS API |

**Bottom line:** shoppers and most vendors are fine on cellular as long as Supabase env vars are set. POS, AI agents, and proxied market images need a **public HTTPS backend URL**.

---

## Recommended: production web + cloud API

Best path for remote testing and real users.

### 1. Deploy web to Vercel

See **[`docs/DEPLOY.md`](DEPLOY.md)** for the full checklist (Vercel + backend + Supabase + mobile).  
Short version also in [`web/README.md`](../web/README.md) → **Production deploy (Vercel)**.

Set these env vars in Vercel (Production):

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(anon key)* |
| `VITE_APP_URL` | `https://vendorly.app` (or your `*.vercel.app` URL) |
| `VITE_API_URL` | `https://api.vendorly.app` (or your deployed API) |

### 2. Supabase auth URLs

In **Supabase → Authentication → URL Configuration**:

- **Site URL:** your production web URL
- **Redirect URLs:** add `https://your-domain/auth/callback`, `https://your-domain/auth/reset-password`, `https://your-domain/**`, and `vendorly://auth/callback`

### 3. Deploy (or tunnel) the backend

The backend must be reachable at the same URL you put in `VITE_API_URL` / `EXPO_PUBLIC_API_URL`.

**Production env (`backend/.env`):**

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://api.vendorly.app
WEB_APP_URL=https://vendorly.app
# Optional: Vercel preview domains, www, etc.
CORS_ORIGINS=https://vendorly.app,https://www.vendorly.app,https://your-project.vercel.app
DATABASE_URL=postgresql://...   # Supabase pooler URL
REDIS_URL=rediss://...          # e.g. Upstash — required for POS queues in prod
POS_QUEUES_ENABLED=true
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
```

Build and run with Docker (`backend/Dockerfile`) or your host (Railway, Fly.io, VPS, etc.). Redeploy after CORS changes.

**Dev-only tunnel** (no deploy yet):

```powershell
cd backend
npm run start:dev
# In another terminal:
ngrok http 4000
# or: cloudflared tunnel --url http://localhost:4000
```

Use the `https://…` URL as `VITE_API_URL` / `EXPO_PUBLIC_API_URL` and set `POS_PROVIDER_BASE_URL` to the same tunnel for Square OAuth.

### 4. Mobile app (cellular / remote)

In `mobile/.env` (or EAS secrets for store builds):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=https://api.vendorly.app
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://YOUR-PROJECT.supabase.co/storage/v1/object/public/auth/auth-redirect.html
```

Do **not** use `http://192.168.x.x:4000` or `http://10.x.x.x:4000` for off-LAN use — those only work on the same Wi‑Fi.

Restart Expo after env changes: `npx expo start --clear`.

---

## Local dev on another device (same Wi‑Fi)

When you want to test **dev builds** from a phone on the same LAN (not cellular):

| App | Setting |
|-----|---------|
| Web | Open `http://YOUR-PC-LAN-IP:5173` — Vite binds `0.0.0.0` by default; API auto-targets `:4000` on that host |
| Mobile | `EXPO_PUBLIC_API_URL=http://YOUR-PC-LAN-IP:4000` |
| Backend | `npm run start:dev` (listens on `0.0.0.0:4000`); allow port 4000 in Windows Firewall |

---

## Local dev off LAN (Metro tunnel)

Supabase still works. To load the **JavaScript bundle** when your phone is not on the same network as your dev machine:

```powershell
cd mobile
npx expo start --tunnel
```

Scan the QR code in Expo Go. You still need a **public** `EXPO_PUBLIC_API_URL` (deployed API or ngrok/cloudflared) for POS and proxied market images.

For web dev off LAN, use the Vercel preview/production site instead of `localhost:5173`.

---

## What blocked off-LAN before

1. **`EXPO_PUBLIC_API_URL` / `VITE_API_URL` pointed at LAN IPs** — unreachable on cellular.
2. **Web dev auto-API on `:4000`** — only works when the browser host can reach your PC on the LAN.
3. **Backend CORS** — production web domain must be in `WEB_APP_URL` / `CORS_ORIGINS`.
4. **Metro default (LAN)** — phone off Wi‑Fi cannot load the dev bundle without `--tunnel`.
5. **Square OAuth** — requires HTTPS `POS_PROVIDER_BASE_URL`; see [`docs/SQUARE_SETUP.md`](SQUARE_SETUP.md).

---

## Quick smoke test (cellular)

1. Open production web URL or Expo build with cloud Supabase env.
2. Sign in — should succeed (Supabase).
3. Browse events / map / reserve — should work (Supabase).
4. Vendor → POS — should reach API if `*_API_URL` is HTTPS public URL.
5. Event cards with photos — images load if API URL is set and backend serves `/public/markets/…`.
