# Roles and routing

## DB roles (`users.role`)

| Vendorly role | DB value | Extension table | Notes |
|---------------|----------|-----------------|-------|
| Customer | `customer` | `shoppers` | Legacy alias `shopper` still used in routes/code |
| Vendor | `vendor` | `vendors` | Requires approval for public listing |
| Chef | `chef` | `chefs` | Requires approval |
| Admin | `admin` | — | Admin portal |

Treat `shopper` as deprecated alias for `customer`. Do not rename `(shopper)` mobile routes unless explicitly requested — optional cleanup only.

## Web route prefixes

- `/shopper/*` — customer (legacy path name)
- `/vendor/*`, `/chef/*`, `/admin/*` — role portals
- `/login`, `/auth/callback` — Supabase auth

## Mobile route groups (Expo Router)

- `(shopper)/(tabs)/` — customer tabs (Home, Discover, Markets, You)
- `(vendor)/`, `(chef)/`, `(admin)/` — role areas
- `(onboarding)/` — role select, interests

## Auth redirect logic

Both platforms resolve destination from: session → user profile → role extension completeness (vendor application, chef profile, shopper interests). Check `auth-redirect` / `auth-profile` libs before changing routing.
