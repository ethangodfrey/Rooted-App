-- Rooted Phase 12: admin RLS policies
-- Run in Supabase SQL Editor after prior phase scripts.
--
-- Promote a pilot admin (replace email):
--   update public.users set role = 'admin' where email = 'you@example.com';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- users: admins can read all profiles (vendor contact info in admin UI)
-- ---------------------------------------------------------------------------
create policy "Admins read all users"
  on public.users for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- vendors: admins review and set approval_status
-- ---------------------------------------------------------------------------
create policy "Admins read all vendors"
  on public.vendors for select
  using (public.is_admin());

create policy "Admins update vendors"
  on public.vendors for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- events: admins seed and edit (Phase 12 events UI)
-- ---------------------------------------------------------------------------
create policy "Admins read all events"
  on public.events for select
  using (public.is_admin());

create policy "Admins insert events"
  on public.events for insert
  with check (public.is_admin());

create policy "Admins update events"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders: read-only admin oversight
-- ---------------------------------------------------------------------------
create policy "Admins read all orders"
  on public.orders for select
  using (public.is_admin());

create policy "Admins read all order items"
  on public.order_items for select
  using (public.is_admin());
