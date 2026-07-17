# Roles and routing

## Marketplace sticker roles (`profiles.role`)

| Rooted role | DB value (`profile_role`) | Extension | Notes |
|-------------|---------------------------|-----------|-------|
| Shopper | `shopper` | `shoppers` | Explore, follow, orders, chat |
| Vendor | `vendor` | `vendors` | Storefront, hand-offs, network, POS |

`public.profiles.role` is a **strict** Postgres enum (`shopper` | `vendor`) — permanent text stickers. Ops roles (`chef`, `admin`) stay on legacy `public.users.role` only.

Legacy aliases still accepted on `users.role`: `customer` → treat as shopper.

## Web route prefixes

| Prefix | Boundary | Status |
|--------|----------|--------|
| `/shopper/*` | Shopper workspace | Active |
| `/explore`, `/orders`, `/following`, `/inbox` | Shopper shared roots | Active |
| `/vendor/*` | Vendor workspace | Active |
| `/chef/*`, `/admin/*` | Ops portals | Active |
| `/onboarding/role`, `/onboarding/role-select` | Sticker role selection | Active |

## Mobile route groups (Expo Router)

| Group | Boundary | Status |
|-------|----------|--------|
| `app/(shopper)/` | Shopper-only screens + tabs | Active |
| `app/(vendor)/` | Vendor workspace | Active |
| `app/(chef)/`, `app/(admin)/` | Ops | Active |
| `app/(onboarding)/` | Role select, interests | Active |

### Shopper boundary inventory (`app/(shopper)`)

Keep shopper discovery, cart/checkout, orders, saved, and profile here:

- Tabs: `home`, `explore`, `feed`, `events`, `map`, `search`, `profile`
- Stack: `vendors/[id]`, `products/[id]`, `events/[id]`, `orders/*`, `checkout/*`, `saved`, `chefs/*`, `bookings/*`, `leftovers/*`, `profile/edit`

### Vendor boundary inventory (`app/(vendor)`)

Keep storefront, inventory, hand-offs, network, POS, and media here:

- Tabs: `dashboard`, `products`, `orders`, `feed`, `more`
- Stack: `profile/*`, `products/*`, `posts/*`, `pos/*`, `analytics/*`, `compliance/*`, `map`, `explore/*`, `leftovers/*`, `events`, `sales/*`, `media/*`

Never nest shopper cart/order flows inside vendor layouts.

## Auth redirect logic

Both platforms resolve destination from: session → `profiles`/`users` role → role extension completeness (vendor application, chef profile, shopper interests). Check `auth-redirect` / `auth-profile` libs before changing routing.

Sticker onboarding writes `profiles.role` first (phase51); sync trigger mirrors into `users.role` for existing clients.
