# Deploy troubleshooting

## Railway `/` returns 404 JSON — NOT A BUG

NestJS API has no route at `/`. Expected response:

```json
{"message":"Cannot GET /","error":"Not Found","statusCode":404}
```

**Test these instead:**

| Path | Pass |
|------|------|
| `/health/live` | 200 + `{"status":"ok"}` |
| `/health/ready` | 200 + `"db":"up"` |

Never use Railway root URL as a "website" smoke test.

## `/health/live` 200 but `/health/ready` 503

**Cause:** `DATABASE_URL` wrong, missing, or password not URL-encoded.

**Fix:**

1. Supabase → Settings → Database → **Connect** → **URI** → **Transaction pooler** (port **6543**)
2. Reset DB password if unknown (Settings → Database → Reset database password)
3. Replace `[YOUR-PASSWORD]` in connection string
4. If password contains `@ # % & + = ?` → URL-encode or reset to alphanumeric-only password
5. Railway Variables → `DATABASE_URL` — no quotes, no trailing spaces
6. Set `POS_QUEUES_ENABLED=false` until Upstash Redis is configured
7. **Redeploy** Railway after saving vars

**Verify:**

```powershell
curl https://YOUR-SERVICE.up.railway.app/health/ready
```

Pass: `"ok":true,"db":"up"`

## Vercel blank page

Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build → redeploy after setting vars.

## Vercel API calls fail / CORS

- `VITE_API_URL` must match Railway public URL (until custom domain DNS live)
- Railway: `CORS_ORIGINS` includes Vercel origin
- Redeploy **both** after env changes

## Agent prompt template (Cursor)

```
Follow agent-os/standards/deploy/runbook.md and deploy/troubleshooting.md.
Current state: [paste /health/live and /health/ready results]
Help me fix DATABASE_URL on Railway step by step. Do not ask me to test Railway / root URL.
```
