-- Vendorly Phase 83b — Vendor-to-Vendor (V2V) connections + wholesale product visibility
-- Apply after phase82.
--
-- LinkedIn-style vendor network:
--   • pending / connected / ignored relationship between two vendors
--   • optional follow flags (each side can follow the other)
--   • products.visibility gates bulk/wholesale SKUs to connected peers via RLS

-- ---------------------------------------------------------------------------
-- 1. Product visibility
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists visibility text not null default 'public';

alter table public.products drop constraint if exists products_visibility_check;
alter table public.products
  add constraint products_visibility_check
  check (visibility in ('public', 'connected_vendors', 'private'));

comment on column public.products.visibility is
  'Phase 83b: public (shoppers) | connected_vendors (V2V wholesale) | private (owner only).';

create index if not exists products_visibility_idx
  on public.products (visibility)
  where visibility <> 'public';

-- ---------------------------------------------------------------------------
-- 2. vendor_connections
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.vendors (id) on delete cascade,
  receiver_id uuid not null references public.vendors (id) on delete cascade,
  -- none = follow-only / no active request; pending|connected|ignored = connection lifecycle
  status text not null default 'none'
    check (status in ('none', 'pending', 'connected', 'ignored')),
  -- Bidirectional follow on the same unordered pair row
  is_following boolean not null default false,          -- sender follows receiver
  receiver_is_following boolean not null default false, -- receiver follows sender
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_connections_no_self check (sender_id <> receiver_id)
);

-- Idempotent: table may already exist from an earlier partial apply without follow cols.
alter table public.vendor_connections
  add column if not exists is_following boolean not null default false;
alter table public.vendor_connections
  add column if not exists receiver_is_following boolean not null default false;
alter table public.vendor_connections
  add column if not exists updated_at timestamptz not null default now();

comment on table public.vendor_connections is
  'Phase 83b: V2V connection requests + follow flags between vendor profiles.';
comment on column public.vendor_connections.is_following is
  'True when sender_id is following receiver_id.';
comment on column public.vendor_connections.receiver_is_following is
  'True when receiver_id is following sender_id.';

-- One relationship per unordered vendor pair (A↔B), regardless of who sent first
create unique index if not exists vendor_connections_pair_uidx
  on public.vendor_connections (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id)
  );

create index if not exists vendor_connections_sender_idx
  on public.vendor_connections (sender_id, status);

create index if not exists vendor_connections_receiver_idx
  on public.vendor_connections (receiver_id, status);

create or replace function public.set_vendor_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_connections_set_updated_at on public.vendor_connections;
create trigger vendor_connections_set_updated_at
  before update on public.vendor_connections
  for each row execute function public.set_vendor_connections_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Helpers (security definer for stable RLS predicates)
-- ---------------------------------------------------------------------------

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.vendors where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_vendor_id() from public;
grant execute on function public.current_vendor_id() to authenticated;

create or replace function public.vendors_are_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendor_connections vc
    where vc.status = 'connected'
      and (
        (vc.sender_id = a and vc.receiver_id = b)
        or (vc.sender_id = b and vc.receiver_id = a)
      )
  );
$$;

revoke all on function public.vendors_are_connected(uuid, uuid) from public;
grant execute on function public.vendors_are_connected(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS — vendor_connections
-- ---------------------------------------------------------------------------

alter table public.vendor_connections enable row level security;

drop policy if exists "Vendors read own connections" on public.vendor_connections;
create policy "Vendors read own connections"
  on public.vendor_connections for select
  to authenticated
  using (
    sender_id = public.current_vendor_id()
    or receiver_id = public.current_vendor_id()
  );

drop policy if exists "Vendors send connection requests" on public.vendor_connections;
create policy "Vendors send connection requests"
  on public.vendor_connections for insert
  to authenticated
  with check (sender_id = public.current_vendor_id());

drop policy if exists "Vendors update own connections" on public.vendor_connections;
create policy "Vendors update own connections"
  on public.vendor_connections for update
  to authenticated
  using (
    sender_id = public.current_vendor_id()
    or receiver_id = public.current_vendor_id()
  )
  with check (
    sender_id = public.current_vendor_id()
    or receiver_id = public.current_vendor_id()
  );

drop policy if exists "Vendors delete own pending connections" on public.vendor_connections;
create policy "Vendors delete own pending connections"
  on public.vendor_connections for delete
  to authenticated
  using (
    sender_id = public.current_vendor_id()
    and status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- 5. RLS — products SELECT (visibility-aware)
-- ---------------------------------------------------------------------------

-- Replace broad public read so connected_vendors / private SKUs stay hidden.
drop policy if exists "Public read active products of approved vendors" on public.products;

drop policy if exists "Read products by visibility and V2V connection" on public.products;
create policy "Read products by visibility and V2V connection"
  on public.products for select
  using (
    status = 'active'
    and vendor_id in (
      select id from public.vendors where approval_status = 'approved'
    )
    and (
      -- Owner always sees own catalog (including private / V2V)
      vendor_id = public.current_vendor_id()
      or visibility = 'public'
      or (
        visibility = 'connected_vendors'
        and public.current_vendor_id() is not null
        and public.vendors_are_connected(public.current_vendor_id(), vendor_id)
      )
    )
  );

-- "Vendors manage own products" (phase7 FOR ALL) remains for insert/update/delete.
