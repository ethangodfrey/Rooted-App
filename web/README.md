# Rooted Website

Marketing site + full web app for Rooted — shoppers and vendors can sign in and use the same Supabase backend as the mobile app.

## Stack

- Vite + React + TypeScript
- React Router
- Supabase Auth + Postgres (same project as `mobile/`)

## Setup

1. Copy env vars from the mobile app:

```powershell
cd web
copy .env.example .env
```

2. Add your Supabase credentials to `web/.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

Use the same values as `mobile/.env` (`EXPO_PUBLIC_SUPABASE_*`).

3. In **Supabase Dashboard → Authentication → URL Configuration**, add redirect URLs:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/auth/reset-password`
- Your production domain equivalents when deployed

## Development

```powershell
npm install
npm run dev
```

- **Marketing site:** http://localhost:5173
- **Sign in:** http://localhost:5173/login
- **After login:** routes to shopper or vendor dashboard automatically

## Web app features

### Shoppers
- Sign up / sign in / password reset
- Role selection + interests onboarding
- Discover (search), Events, Map, Feed, Profile tabs
- Vendor storefronts, product detail, reserve for pickup
- Order history

### Vendors
- Vendor application setup
- Dashboard, Orders, Products, Posts, Profile tabs
- Create products (with photos, limits) and set per-event availability
- Join/leave markets (vendor events)
- Log in-person sales
- Connect Square POS, sync, and item mappings
- Analytics with CSV export
- Edit storefront
- Manage order status
- Leftovers listings
- Video posts

### Admins
- Vendor approval/rejection with AI review suggestions
- Event create/edit/publish
- Read-only order browser
- Post moderation queue with AI assist

## Environment

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:4000   # backend — POS, admin AI agents
```

```powershell
npm run build
npm run preview
```

Deploy `dist/` to Vercel, Netlify, etc. Set `VITE_APP_URL` to your production URL.
