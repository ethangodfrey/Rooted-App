# Rooted MVP — Build Plan

> **Note (June 2026):** This document describes the original Phase 1–12 mobile MVP plan. The repo has since grown into a monorepo with `web/`, `backend/` (NestJS + Prisma), SQL phases through **22**, POS, market discovery, and admin AI agents. For current launch steps, see [`LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md).

**Approach:** Flat `mobile/` app + Supabase only. No NestJS, Prisma, or monorepo packages until mobile MVP is proven.

**Stack (Phase 1+):** Expo SDK 54 · Expo Router · TypeScript · Supabase (Auth + Postgres + Storage) · NativeWind (from Phase 2)

**Source of truth:** [`Context - Rooted - Marketplace App.txt`](./Context%20-%20Rooted%20-%20Marketplace%20App.txt) · Product spec · Monorepo profile/structure (future target — not built now)

**V1 transaction model:** Model A — Reserve and pay at pickup (`payment_status: 'unpaid'` until vendor marks paid in person).

---

## Principles

1. **One phase, one test.** Finish and verify each phase before starting the next.
2. **Mobile-first.** No browser-only APIs unless wrapped in `Platform.OS === 'web'`.
3. **Role isolation early.** Split shopper and vendor flows immediately after auth.
4. **Direct Supabase.** Mobile uses Supabase client + RLS; no NestJS, Prisma, or custom API.
5. **Incremental routes.** Every new screen must mount without breaking Expo Router.
6. **Event-mapped inventory.** Products are reservable only when linked to an event via `product_event_availability` (context business rule).
7. **No Phase 2 scaffolding.** Do not build payments, realtime messaging, subscriptions, or organizer portals unless explicitly requested.

---

## Phase overview

| Phase | Focus | Tables / objects | Test gate |
|-------|--------|------------------|-----------|
| **1** | Supabase auth + role selection | `users`, `shoppers`, `vendors` | Sign up → pick role → correct home |
| **2** | NativeWind + app shell | — | Styled auth + tab shells on device |
| **3** | Role onboarding | `users`, `shoppers`, `vendors` | Shopper sets interests; vendor submits profile |
| **4** | Events (list + detail) | `events` | Shopper browses seeded public events |
| **5** | Event map | `events` | Events render as map pins |
| **6** | Vendor ↔ event participation | `vendor_events` | Vendor joins event; shopper sees vendors on event |
| **7** | Products + dual-channel inventory | `products`, `product_event_availability` | Presale vs in-person caps per event |
| **8** | Saved vendors | `shoppers.saved_vendors` | Favorite persists on vendor profile |
| **9** | Reserve-for-pickup orders | `orders`, `order_items` | Full Model A lifecycle; presale cap enforced |
| **10** | Vendor feed (posts) | `posts` | Favorited shoppers see vendor posts |
| **11** | Analytics + manual sales | `inventory_transactions`, `analytics_snapshots` | Dashboard metrics; offline sale logged |
| **12** | Admin views + MVP hardening | all tables | Admin approves vendor; full happy path passes |

**Deferred (Context §7 — do not scaffold):** Stripe payments, multi-vendor cart, realtime message push, subscriptions, organizer portals, `messages` threads (unless explicitly added later).

---

## Phase 1 — Supabase auth + role selection

**Goal:** Sign up, sign in, choose shopper or vendor, create the matching role row, land on a role-specific placeholder home.

### 1.1 — Supabase project & environment

**Tasks**

- Create a Supabase project.
- Enable **Email** auth (Google/Apple later).
- Add `mobile/.env`:

  ```env
  EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```

- Add `mobile/.env.example` (no real values).
- Confirm `mobile/.env` is gitignored.

**Test**

- [ ] `EXPO_PUBLIC_*` vars load; `npx expo start` runs clean.

---

### 1.2 — `users` table + RLS (SQL in Supabase)

**Tasks**

Run in Supabase SQL Editor:

```sql
-- users (1:1 with auth.users)
create table public.users (
  id                      uuid primary key references auth.users (id) on delete cascade,
  role                    text check (role in ('shopper', 'vendor', 'admin')),
  name                    text,
  email                   text,
  phone                   text,
  profile_photo           text,
  city                    text,
  state                   text,
  zip_code                text,
  location_coordinates    point,
  notification_preferences jsonb default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.users enable row level security;

-- Auto-create user row on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users read own row"
  on public.users for select using (auth.uid() = id);

create policy "Users update own row"
  on public.users for update using (auth.uid() = id);

-- shoppers (created when role = shopper)
create table public.shoppers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.users (id) on delete cascade,
  interests        text[] default '{}',
  saved_vendors    uuid[] default '{}',
  saved_events     uuid[] default '{}',
  default_location text
);

alter table public.shoppers enable row level security;

create policy "Shoppers read own row"
  on public.shoppers for select using (auth.uid() = user_id);

create policy "Shoppers update own row"
  on public.shoppers for update using (auth.uid() = user_id);

create policy "Shoppers insert own row"
  on public.shoppers for insert with check (auth.uid() = user_id);

-- vendors (created when role = vendor)
create table public.vendors (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users (id) on delete cascade,
  business_name         text,
  business_description  text,
  logo_url              text,
  banner_url            text,
  theme_settings        jsonb default '{}'::jsonb,
  category              text,
  website_url           text,
  instagram_url         text,
  approval_status       text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  messaging_enabled     boolean not null default false,
  custom_orders_enabled boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.vendors enable row level security;

create policy "Vendors read own row"
  on public.vendors for select using (auth.uid() = user_id);

create policy "Vendors update own row"
  on public.vendors for update using (auth.uid() = user_id);

create policy "Vendors insert own row"
  on public.vendors for insert with check (auth.uid() = user_id);

create policy "Public read approved vendors"
  on public.vendors for select using (approval_status = 'approved');
```

**Test**

- [ ] Sign up → `users` row with `email`, `role` null.
- [ ] Authenticated client can `select` own `users` row.

---

### 1.3 — Install dependencies

**Tasks**

```bash
cd mobile && npx expo install @supabase/supabase-js expo-secure-store
```

- `src/lib/supabase.ts` — client with `expo-secure-store` session persistence.
- `src/types/database.ts` — `User`, `Shopper`, `Vendor`, `UserRole` types.

**Test**

- [ ] App builds; `supabase.auth.getSession()` returns null when logged out.

---

### 1.4 — Auth provider & hooks

**Tasks**

- `src/providers/auth-provider.tsx`
  - `onAuthStateChange` subscription.
  - Fetch `users` row; if `role === 'shopper'` also fetch `shoppers`; if `role === 'vendor'` also fetch `vendors`.
  - Expose: `session`, `user`, `shopper`, `vendor`, `isLoading`, `signOut`, `refreshUser`.
- `src/hooks/use-auth.ts`

**Test**

- [ ] No infinite re-render; after login `user.email` matches auth user.

---

### 1.5 — Auth screens

**Tasks**

`app/(auth)/`:

| File | Purpose |
|------|---------|
| `_layout.tsx` | Stack |
| `login.tsx` | Email + password sign-in |
| `signup.tsx` | Email + password sign-up |
| `forgot-password.tsx` | Reset email (stub OK) |

**Test**

- [ ] Sign up / sign in / sign out work with inline Supabase errors.

---

### 1.6 — Role selection screen

**Tasks**

`app/(onboarding)/role-select.tsx` — choose **Shopper** or **Vendor**.

On selection (transactional via app logic):

```ts
// 1. Set role on users
await supabase.from('users').update({ role }).eq('id', authUser.id);

// 2. Create role extension row
if (role === 'shopper') {
  await supabase.from('shoppers').insert({ user_id: authUser.id });
} else {
  await supabase.from('vendors').insert({
    user_id: authUser.id,
    approval_status: 'pending',
  });
}
```

**Rules**

- Show only when `session` exists and `user.role` is null.
- Cross-role conversion later requires admin (context §6).

**Test**

- [ ] Shopper → `users.role = 'shopper'` + `shoppers` row.
- [ ] Vendor → `users.role = 'vendor'` + `vendors` row with `approval_status = 'pending'`.
- [ ] Re-open app skips role-select when role is set.

---

### 1.7 — Auth gate & role-based routing

**Tasks**

```
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
├── (onboarding)/
├── (shopper)/
│   ├── _layout.tsx          # guard: user.role === 'shopper'
│   └── (tabs)/home.tsx
└── (vendor)/
    ├── _layout.tsx          # guard: user.role === 'vendor'
    └── (tabs)/dashboard.tsx
```

**Redirect logic (`app/index.tsx`)**

```
if isLoading           → null
if !session            → /(auth)/login
if !user.role          → /(onboarding)/role-select
if role === 'shopper'  → /(shopper)/(tabs)/home
if role === 'vendor'   → /(vendor)/(tabs)/dashboard
```

Remove default template `(tabs)/` once new routes work.

**Test**

- [ ] Signed out → login.
- [ ] Roles cannot cross-access stacks.
- [ ] Session reload preserves correct home.

---

### Phase 1 completion checklist

- [ ] `users`, `shoppers`, `vendors` tables with RLS
- [ ] Email auth + role selection creates correct extension row
- [ ] Auth gate routes to shopper/vendor placeholder homes
- [ ] `.env.example` committed; no NestJS/Prisma/packages

---

## Phase 2 — NativeWind + app shell

**Goal:** Consistent design system; full tab scaffolding for both roles.

**Tasks**

- NativeWind v4 for Expo SDK 54.
- `src/components/ui/`: `Button`, `Input`, `Card`, `Text`.
- Restyle auth + onboarding screens.
- Shopper tabs (stub): Home, Events, Map, Feed, Profile.
- Vendor tabs (stub): Dashboard, Orders, Products, Feed, More.

**Test**

- [ ] Auth + both tab bars render on iOS/Android.

---

## Phase 3 — Role-specific onboarding

**Goal:** Complete minimum profile data before main app use.

### Shopper (`app/(onboarding)/interests.tsx`)

- Collect `interests` (text[]), optional `city` / `zip_code` on `users`.
- Update `shoppers.default_location` if provided.
- Redirect to shopper home.

### Vendor (`app/(vendor)/profile/setup.tsx`)

- Collect `business_name`, `business_description`, `category`.
- Block dashboard until `business_name` is set.
- Show **pending approval** state (`approval_status = 'pending'`); public listing waits for admin (Phase 12).

**Test**

- [ ] Shopper onboarding saves interests.
- [ ] Vendor cannot reach dashboard without `business_name`.
- [ ] Vendor with pending status sees waiting UI, not public storefront.

---

## Phase 4 — Events (list + detail)

**Schema**

```sql
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  organizer_name    text,
  banner_url        text,
  start_datetime    timestamptz not null,
  end_datetime      timestamptz not null,
  address           text,
  city              text,
  state             text,
  latitude          numeric not null,
  longitude         numeric not null,
  event_status      text not null default 'upcoming'
    check (event_status in ('upcoming', 'live', 'completed', 'cancelled')),
  visibility_status text not null default 'public'
    check (visibility_status in ('draft', 'public')),
  parking_info      text,
  admission_info      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Public read public events"
  on public.events for select
  using (visibility_status = 'public');
```

**Tasks**

- Seed 3–5 public `upcoming` events.
- `app/(shopper)/(tabs)/events.tsx` — list (name, date, city).
- `app/(shopper)/events/[id].tsx` — detail (description, times, address).

**Test**

- [ ] Only `visibility_status = 'public'` events appear.
- [ ] Detail screen loads by id.

---

## Phase 5 — Event map

**Tasks**

- `npx expo install react-native-maps expo-location`
- `app/(shopper)/(tabs)/map.tsx` — pins from `events` (lat/lng).
- Location permission + fallback center.
- Pin tap → event detail.

**Test**

- [ ] All seeded events show pins.
- [ ] Permission denial shows fallback (no crash).

---

## Phase 6 — Vendor ↔ event participation

**Schema**

```sql
create table public.vendor_events (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            uuid not null references public.vendors (id) on delete cascade,
  event_id             uuid not null references public.events (id) on delete cascade,
  participation_status text not null default 'requested'
    check (participation_status in ('requested', 'approved', 'declined')),
  booth_details        text,
  setup_notes          text,
  pre_order_enabled    boolean not null default true,
  unique (vendor_id, event_id)
);

alter table public.vendor_events enable row level security;
-- Vendor manages own rows; shoppers read approved participations for public events
```

**Tasks**

- `app/(vendor)/events/index.tsx` — browse events, request/confirm participation.
- Event detail shows attending vendors (`participation_status = 'approved'`).
- `app/(shopper)/vendors/[id].tsx` — vendor storefront stub (approved vendors only).

**Test**

- [ ] Vendor links to event; appears on event detail when approved.
- [ ] Unapproved vendor hidden from shopper event view.

---

## Phase 7 — Products + dual-channel inventory

**Schema**

```sql
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            uuid not null references public.vendors (id) on delete cascade,
  name                 text not null,
  description          text,
  price                integer not null, -- cents
  media_urls           text[] default '{}',
  category             text,
  sku                  text,
  status               text not null default 'active',
  inquiry_enabled      boolean not null default false,
  reserve_enabled      boolean not null default true,
  prepay_enabled       boolean not null default false,
  custom_order_enabled boolean not null default false,
  prep_time            integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.product_event_availability (
  id                          uuid primary key default gen_random_uuid(),
  product_id                  uuid not null references public.products (id) on delete cascade,
  event_id                    uuid not null references public.events (id) on delete cascade,
  available_quantity_presale  integer not null default 0,
  available_quantity_inperson integer not null default 0,
  pre_order_deadline          timestamptz,
  pickup_notes                text,
  unique (product_id, event_id)
);
```

**Business rules (context §6)**

- Product without `product_event_availability` row for an event → **display only** at that event.
- `available_quantity_presale` caps digital reservations.
- `available_quantity_inperson` is protected for booth walk-ups (not decremented by app reserves).

**Tasks**

- Vendor: `products/new.tsx`, `products/[id]/edit.tsx`, assign event availability with presale/in-person quantities.
- Shopper: reservable badge only when `reserve_enabled` + availability row exists + presale qty > 0.

**Test**

- [ ] Vendor sets presale 20 / in-person 30 for Event A.
- [ ] Product without availability row is not reservable at that event.
- [ ] `available_quantity_presale + available_quantity_inperson` validated in UI.

---

## Phase 8 — Saved vendors

**Goal:** Shoppers favorite vendors via `shoppers.saved_vendors` (uuid[]).

**Tasks**

- Toggle on `app/(shopper)/vendors/[id].tsx` — append/remove vendor id in array.
- `app/(shopper)/saved.tsx` or Profile tab section — list saved vendor ids → join `vendors`.

**Test**

- [ ] Favorite persists across reload.
- [ ] Unfavorite removes id from array.
- [ ] Vendor role cannot favorite.

---

## Phase 9 — Reserve-for-pickup orders (Model A)

**Schema**

```sql
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  shopper_id       uuid not null references public.shoppers (id),
  vendor_id        uuid not null references public.vendors (id),
  event_id         uuid not null references public.events (id),
  order_status     text not null default 'submitted'
    check (order_status in (
      'submitted', 'pending_review', 'accepted', 'declined',
      'preparing', 'ready_for_pickup', 'fulfilled', 'cancelled'
    )),
  payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid_at_pickup')),
  fulfillment_type text default 'pickup',
  pickup_datetime  timestamptz,
  subtotal         integer not null,
  tax              integer not null default 0,
  total            integer not null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid not null references public.products (id),
  quantity            integer not null,
  item_price          integer not null,
  customization_data  jsonb,
  fulfillment_status  text
);
```

**Business rules**

- Block checkout if `quantity > available_quantity_presale` (use RPC or DB function).
- Model A only: `payment_status` stays `unpaid` until vendor marks `paid_at_pickup` on fulfill.
- Vendor workflow: `submitted` → `pending_review` → `accepted` | `declined` → `preparing` → `ready_for_pickup` → `fulfilled`.

**Tasks**

- `app/(shopper)/checkout/reserve.tsx` — product, event, quantity, notes.
- `app/(shopper)/orders/index.tsx` + `orders/[id].tsx` — status tracking.
- `app/(vendor)/(tabs)/orders.tsx` + `orders/[id].tsx` — accept/decline/status toggles.

**Test**

- [ ] Reserve blocked when presale cap exceeded.
- [ ] Order requires `product_event_availability` for event.
- [ ] Vendor accept/decline updates shopper view.
- [ ] `payment_status` remains `unpaid` through fulfill (Model A).

---

## Phase 10 — Vendor feed (posts)

**Schema**

```sql
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  event_id   uuid references public.events (id),
  product_id uuid references public.products (id),
  post_type  text not null
    check (post_type in ('promotion', 'launch', 'restock', 'announcement')),
  caption    text not null,
  media_url  text,
  created_at timestamptz not null default now()
);
```

**Tasks**

- `app/(vendor)/posts/new.tsx` — caption, type, optional event/product link.
- `app/(shopper)/(tabs)/feed.tsx` — posts from `saved_vendors` only, sorted by recency (+ city proximity when location available).

**Test**

- [ ] Favorited shopper sees post; non-favorited does not.
- [ ] Vendor sees own posts on vendor feed tab.

---

## Phase 11 — Analytics + inventory transactions

**Schema**

```sql
create table public.inventory_transactions (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id),
  product_id        uuid not null references public.products (id),
  event_id          uuid references public.events (id),
  transaction_type  text not null
    check (transaction_type in ('sale_digital', 'sale_manual', 'adjustment', 'restock')),
  quantity_change   integer not null,
  source            text,
  notes             text,
  created_at        timestamptz not null default now()
);

create table public.analytics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors (id),
  date            date not null,
  revenue_total   integer default 0,
  orders_total    integer default 0,
  product_views   integer default 0,
  conversions     integer default 0,
  event_sales     integer default 0,
  inperson_sales  integer default 0,
  saved_count     integer default 0,
  follower_count  integer default 0,
  unique (vendor_id, date)
);
```

**Business rule (context §6):** On `order_status` → `fulfilled`, insert `inventory_transactions` row (`transaction_type = 'sale_digital'`, negative `quantity_change`).

**Tasks**

- DB trigger or app logic on fulfill → `inventory_transactions`.
- `app/(vendor)/analytics.tsx` — orders by status, revenue (`fulfilled` + `paid_at_pickup`), top products.
- `app/(vendor)/sales/manual.tsx` — log in-person sale (`sale_manual`).
- Basic CSV export (client-side from query results).

**Test**

- [ ] Fulfilling order decrements presale via transaction row.
- [ ] Manual sale appears in analytics.
- [ ] CSV export downloads/opens share sheet.

---

## Phase 12 — Admin views + MVP hardening

**Goal:** Internal admin can approve vendors and seed events; app is pilot-ready.

**Tasks**

- Admin role gate: `user.role === 'admin'` → `app/(admin)/` stack (simple, not public-facing).
- Screens: pending vendors list → approve/reject `approval_status`; events list → create/edit; read-only orders.
- RLS: add admin policies using `exists (select 1 from users where id = auth.uid() and role = 'admin')` or service-role scripts for seeding.
- Polish: loading/error/empty states; sign-out on profile tabs; remove dead Expo template files.
- `mobile/README.md` setup guide.

**Test**

- [ ] Admin approves vendor → shopper can see vendor on event.
- [ ] Full happy path:

  ```
  sign up (vendor) → setup profile → admin approves → join event →
  add product + availability → sign up (shopper) → favorite → reserve →
  vendor accepts → ready → fulfilled → inventory_transaction created
  ```

- [ ] RLS manual audit with shopper, vendor, admin test accounts.
- [ ] Runs on physical device.

---

## Future (post-MVP) — not in this plan

- NestJS + Prisma monorepo migration (`MONOREPO_PROFILE.md`)
- `messages` threads + Supabase Realtime
- Stripe / in-app prepay (`prepay_enabled`)
- Push notifications, subscriptions, organizer portals

---

## Suggested file layout after Phase 1

```
mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   ├── (onboarding)/
│   ├── (shopper)/(tabs)/
│   └── (vendor)/(tabs)/
├── src/
│   ├── lib/supabase.ts
│   ├── providers/auth-provider.tsx
│   ├── hooks/use-auth.ts
│   └── types/database.ts
├── .env.example
└── package.json
```

---

## Quick reference — tables by phase

| Table | Phase |
|-------|-------|
| `users` | 1 |
| `shoppers` | 1 |
| `vendors` | 1 |
| `events` | 4 |
| `vendor_events` | 6 |
| `products` | 7 |
| `product_event_availability` | 7 |
| `orders` | 9 |
| `order_items` | 9 |
| `posts` | 10 |
| `inventory_transactions` | 11 |
| `analytics_snapshots` | 11 |

**Deferred tables:** `messages` (context §7)

---

## Business rules checklist (implement across phases)

| Rule | Phase |
|------|-------|
| Role selected once; cross-role needs admin | 1, 12 |
| Product reservable only with `product_event_availability` | 7, 9 |
| Presale qty cap blocks checkout | 9 |
| In-person stock not depleted by app reserves | 7, 9 |
| Model A: `payment_status = 'unpaid'` until pickup | 9 |
| Fulfill → `inventory_transactions` deduction | 11 |
| Feed from `saved_vendors` only | 10 |
| Approved vendors only public | 3, 6, 12 |

---

*Last updated: June 2026 — aligned with Context file. Phase 1 is the immediate starting point.*
