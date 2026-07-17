# Roles and routing

## Marketplace sticker roles (`profiles.role`)

| Rooted role | DB value (`profile_role`) | Extension | Notes |
|-------------|---------------------------|-----------|-------|
| Shopper | `shopper` | `shoppers` | Explore, follow vendors/farmers, checkout |
| Vendor | `vendor` | `vendors` | Finished goods, pre-orders, B2B network |
| Farmer | `farmer` | `farmers` | Raw/bulk harvest, F2V supply connections |

`public.profiles.role` is a **strict** Postgres enum (`shopper` | `vendor` | `farmer`) — permanent text stickers (`SHOPPER` / `VENDOR` / `FARMER`, no emojis). Ops roles (`chef`, `admin`) stay on legacy `public.users.role` only.

Legacy aliases still accepted on `users.role`: `customer` → treat as shopper.

## Social graph

| Table | Edges |
|-------|--------|
| `follows` | `shopper_id` → `followed_profile_id` (both `profiles.id`) |
| `network_connections` | `sender_id` ↔ `receiver_id` (vendor/farmer profiles; `pending` \| `connected`) |

## Web route prefixes

| Prefix | Boundary | Status |
|--------|----------|--------|
| `/shopper/*` | Shopper workspace | Active |
| `/explore`, `/orders`, `/following`, `/inbox` | Shopper shared roots | Active |
| `/vendor/*` | Vendor workspace (farmers may enter network) | Active |
| `/chef/*`, `/admin/*` | Ops portals | Active |
| `/onboarding/role`, `/onboarding/role-select` | Sticker role selection | Active |

## Mobile route groups (Expo Router)

| Group | Boundary | Status |
|-------|----------|--------|
| `app/(shopper)/` | Shopper-only screens + tabs | Active |
| `app/(vendor)/` | Vendor workspace | Active |
| `app/(chef)/`, `app/(admin)/` | Ops | Active |
| `app/(onboarding)/` | Role select, interests | Active |

Never nest shopper cart/order flows inside vendor layouts.

## Auth redirect logic

Both platforms resolve destination from: session → `profiles`/`users` role → role extension completeness. Check `auth-redirect` / `auth-profile` libs before changing routing.

Sticker onboarding writes `profiles.role` first (phase51); sync trigger mirrors into `users.role` for existing clients. Farmers land on the vendor network surface until a dedicated farmer shell is added.
