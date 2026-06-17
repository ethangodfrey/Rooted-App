# Rooted Mobile App

Expo + Supabase mobile client for the Rooted local marketplace MVP.

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) on a physical device, or iOS Simulator / Android emulator
- A Supabase project with the Rooted schema applied

## Setup

1. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Fill in `mobile/.env`:

   - `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
   - `EXPO_PUBLIC_API_URL` — optional NestJS backend URL for Square POS (LAN IP or tunnel)
   - `EXPO_PUBLIC_AUTH_REDIRECT_URL` — optional hosted auth redirect page for password reset

4. Run Supabase SQL scripts in order (Supabase SQL Editor):

   - `docs/supabase/phase1_auth.sql`
   - `docs/supabase/phase1_storage_auth_redirect.sql` (if using email links)
   - `docs/supabase/phase4_events.sql`
   - `docs/supabase/phase6_vendor_events.sql`
   - `docs/supabase/phase7_products.sql`
   - `docs/supabase/phase7_product_media_storage.sql`
   - `docs/supabase/phase9_orders.sql`
   - `docs/supabase/phase9_reservation_limits.sql`
   - `docs/supabase/phase10_posts.sql`
   - `docs/supabase/phase10_post_scheduling.sql`
   - `docs/supabase/phase11_analytics.sql`
   - `docs/supabase/phase12_admin.sql`
   - `docs/supabase/phase12_onboarding_role_reset.sql`
   - `docs/supabase/phase12_vendor_application.sql`

5. Promote a pilot admin:

   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

6. Start the app:

   ```bash
   npx expo start
   ```

   Scan the QR code with Expo Go, or press `i` / `a` for simulator.

## Roles

| Role | Entry after sign-in |
|------|---------------------|
| Shopper | Discover, events, map, feed, reservations |
| Vendor | Dashboard, orders, products, POS (if backend configured) |
| Admin | Vendor approvals, events, read-only orders |

## Happy-path pilot test

1. Sign up as **vendor** → complete setup → wait for admin approval
2. Admin approves vendor in **Admin → Vendors**
3. Vendor joins an event and adds a product with presale availability
4. Sign up as **shopper** → favorite vendor → reserve at event
5. Vendor accepts → prepares → ready → fulfilled
6. Confirm inventory transaction and analytics update

## Troubleshooting

- **Stuck on role selection after picking the wrong role** — use the arrow back button on interests or vendor setup screens.
- **Admin screens show RLS errors** — run `docs/supabase/phase12_admin.sql`.
- **POS / Square OAuth** — see `docs/SQUARE_SETUP.md` and start the Cloudflare tunnel script if needed.
