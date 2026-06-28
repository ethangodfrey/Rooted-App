# Web auth

## Stack

- Supabase Auth with PKCE (`web/src/lib/supabase.ts`)
- `AuthProvider` wraps app; `useAuth()` for session + profile
- OAuth: Google/Apple buttons exist; providers must be enabled in Supabase dashboard

## Key files

- `lib/supabase.ts` — client + `isSupabaseConfigured`
- `lib/auth-profile.ts` — loads user, shopper, vendor, chef
- `lib/auth-redirect.ts` — post-login routing
- `pages/auth/LoginPage.tsx` — shows config error when Supabase unset
- `pages/auth/AuthCallbackPage.tsx` — OAuth return

## Supabase URL config (production)

Redirect URLs must include:

- `https://YOUR-DOMAIN/auth/callback`
- `https://YOUR-DOMAIN/auth/reset-password`

Site URL = public web origin (Vercel URL until custom domain).

## Rules

- Skip Supabase auth init when `!isSupabaseConfigured`
- Never commit `.env` — only `.env.example`
