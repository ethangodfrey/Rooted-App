# Mobile (Expo)

## Version lock

**Expo SDK 54** — read exact docs at https://docs.expo.dev/versions/v54.0.0/ before writing mobile code.

## Structure

- `mobile/app/` — Expo Router file-based routes
- `mobile/src/lib/` — shared logic (mirror web patterns where possible)
- `mobile/src/components/` — UI
- Scheme: `vendorly` (deep links)

## Env vars

| Var | Purpose |
|-----|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Same project as web |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `EXPO_PUBLIC_API_URL` | Backend HTTPS URL (not LAN IP for store builds) |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | Supabase storage auth-redirect.html URL |

## Parity with web

When adding features, check if web already has equivalent in `web/src/lib/` or `web/src/pages/`. Prefer shared behavior (unified search, geocode, auth-profile) over divergent implementations.

## Verification

```powershell
cd mobile
npx tsc --noEmit
```

## AGENTS.md

Mobile `CLAUDE.md` points to repo-root `AGENTS.md` — follow monorepo priorities there.
