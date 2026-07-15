# Square setup (Vendorly POS)

## Production OAuth (tenant-web)

1. Square Developer Dashboard → OAuth → Redirect URL:
   `https://<tenant-web-host>/api/auth/callback/square`
2. Set tenant-web env: `SQUARE_ENVIRONMENT=production`, `SQUARE_APPLICATION_ID`,
   `SQUARE_APPLICATION_SECRET`, `POS_CREDENTIAL_KEY`, `POS_OAUTH_STATE_SECRET`,
   `INTEGRATION_OAUTH_BASE_URL`.
3. Apply `docs/supabase/phase46_encrypted_credentials.sql`.
4. Vendor dashboard → **Connect your Square Account** (calls `/api/auth/square`).

See `docs/supabase/PHASE46_ENCRYPTED_CREDENTIALS_DESIGN.md`.

---

# Square sandbox setup (legacy Nest POS)

Follow these steps once to connect the Rooted backend and mobile app to Square
**Sandbox** for development.

## 1. Create a Square application

1. Go to [developer.squareup.com/apps](https://developer.squareup.com/apps) → **Create app**.
2. Name it (e.g. `Rooted Dev`) and choose **Sandbox** for testing.
3. Open the app → **OAuth** (left sidebar).

## 2. HTTPS tunnel (required for OAuth)

Square **requires HTTPS** for OAuth redirect URLs. A LAN `http://` address will be
rejected in the Developer Dashboard and by the Rooted backend.

### Option A — Cloudflare Tunnel (no signup, easiest on Windows)

```powershell
winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:4000
```

Copy the `https://….trycloudflare.com` URL from the output (no trailing slash).
Keep this terminal open while testing — the URL changes each time you restart it.

### Option B — ngrok (stable URL with free account)

```powershell
winget install Ngrok.Ngrok
```

1. Sign up at [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Copy your authtoken from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Run:

```powershell
ngrok config add-authtoken YOUR_TOKEN_HERE
ngrok http 4000
```

Copy the **HTTPS** forwarding URL, e.g. `https://abc123.ngrok-free.app` (no trailing slash).

> If `ngrok` is not recognized, close and reopen the terminal after installing.

### Set `backend/.env`

```env
# Square OAuth + webhooks (HTTPS, publicly reachable via tunnel).
POS_PROVIDER_BASE_URL=https://abc123.ngrok-free.app

# Optional: keep a LAN URL here for other uses; mobile uses EXPO_PUBLIC_API_URL instead.
PUBLIC_BASE_URL=http://10.0.0.165:4000
```

Restart the backend after changing env vars.

> **Tip:** If you only have one public URL, you can set `PUBLIC_BASE_URL` to the
> HTTPS tunnel instead and skip `POS_PROVIDER_BASE_URL`.

### Register the OAuth redirect in Square

Under **OAuth → Redirect URL**, add:

```
https://abc123.ngrok-free.app/pos/oauth/square/callback
```

Must match `{POS_PROVIDER_BASE_URL}/pos/oauth/square/callback` exactly.

### Open a sandbox test account first (required)

Square Sandbox OAuth **cannot** show the Allow screen until a Sandbox seller session
is already open in the **same browser**. If you skip this, Square often lands you on
Developer Console → **Applications** (looks like a broken redirect) with error:

> To start the OAuth flow for a sandbox account, first launch the seller test account
> from the Developer Console.

Web Vendor → Point of Sale uses a two-step card:

1. **Open Developer Console** → your app → **Sandbox test accounts** → **Open**
   (Sandbox Dashboard). Leave that tab open.
2. Check “Sandbox seller dashboard is open…” → **Authorize with Square**
3. Tap **Allow** → return to Vendorly on “Square connected”

Railway redirect URL to register under OAuth → Redirect URL (**Sandbox**):

`https://rooted-app-production-43fb.up.railway.app/pos/oauth/square/callback`

`SQUARE_ENVIRONMENT` must be exactly `sandbox` or `production` (not an authorize URL).

> If Authorize still fails, step 1 was skipped or a different browser/profile was used.
> Production OAuth works differently (real Square seller login — no test-account launch).

## 3. Copy credentials into `backend/.env`

From the app **Credentials** page (Sandbox tab):

```env
SQUARE_ENVIRONMENT=sandbox
SQUARE_APPLICATION_ID=sandbox-sq0idb-...
SQUARE_APPLICATION_SECRET=sandbox-sq0csb-...
```

Restart the backend after saving.

## 4. Verify infrastructure

```bash
cd backend
npm run start:dev
```

Check readiness (local or via tunnel):

```
GET http://localhost:4000/health
→ {"status":"ok","db":"up","redis":"up"}
```

Required env vars:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres (pos_* tables) |
| `REDIS_URL` | Upstash TCP URL (sync jobs) |
| `SUPABASE_URL` | Verify mobile bearer tokens (ES256 JWKS) |
| `POS_CREDENTIAL_KEY` | Encrypt stored OAuth tokens |
| `POS_PROVIDER_BASE_URL` | **HTTPS** OAuth redirect + webhooks (tunnel) |
| `SQUARE_APPLICATION_ID` / `_SECRET` | Square OAuth |

## 5. Mobile app

`mobile/.env` — the phone can still talk to the backend over your LAN:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000
```

Only Square's browser redirect needs the HTTPS tunnel; API calls from the app do not.

Restart Expo (`npx expo start --clear`). Phone and PC must be on the same Wi‑Fi.

**Connect flow:**

1. Vendor → Dashboard → **Point of sale** → **Connect Square**
2. Browser opens Square sandbox login → authorize
3. Square redirects to your **HTTPS** tunnel → backend exchanges the code, registers
   webhooks (best-effort), queues a **30-day backfill sync**
4. App returns to the POS list with an active connection

## 6. Webhooks (real-time updates)

Square webhooks are **application-level** — they use your app's access token, not the
merchant OAuth token from Connect Square.

1. In the Square Developer Dashboard → your app → **Credentials** → copy the
   **Sandbox access token** (starts with `EAAA…`).
2. Add to `backend/.env`:

```env
SQUARE_ACCESS_TOKEN=EAAAl...
```

3. Keep `POS_PROVIDER_BASE_URL` set to your **running** HTTPS tunnel.
4. Restart the backend, then tap **Enable real-time updates** in the app (or reconnect Square).

Rooted registers one webhook subscription for the whole app. All vendors who connect
Square receive events through that URL.

If the tunnel URL changes, update Square's OAuth redirect URL, `POS_PROVIDER_BASE_URL`,
restart the tunnel + backend, then tap **Enable real-time updates** again.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Square won't accept redirect URL | Must be `https://` — use ngrok, not LAN IP |
| `Square OAuth requires an HTTPS redirect URL` | Set `POS_PROVIDER_BASE_URL=https://...` and restart backend |
| `SQUARE_APPLICATION_ID is not configured` | Add Square creds to `.env`, restart backend |
| `401` / invalid or expired token | Set `SUPABASE_URL` in backend `.env`; log out and back into the app as a vendor |
| OAuth redirect mismatch | Square URL must equal `{POS_PROVIDER_BASE_URL}/pos/oauth/square/callback` |
| ngrok interstitial page | Free ngrok may show a warning page once per browser session — click through |
| Browser doesn't return to app | Mobile passes `appReturnUrl` automatically; ensure Expo deep link works |
| Sync does nothing | Check `/health` → `redis: up`; verify Upstash `REDIS_URL` |
| No sales after sync | Map register items under **Item mappings**; check sync runs on connection detail |
| Webhook registration unavailable | Add `SQUARE_ACCESS_TOKEN`, keep tunnel running, restart backend |
