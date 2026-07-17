-- Rooted — B2B V2V / F2V connections (2026-07-17)
-- Apply after phase51_network_and_stickers.sql (+ phase52 specialties recommended).
--
-- Canonical table: public.vendor_connections
--   sender_id / receiver_id → profiles (vendor|farmer only)
--   status: pending | connected | ignored
-- Unique unordered pair prevents duplicate requests either direction.
-- Accepting a connection initializes a B2B messaging thread.

-- ---------------------------------------------------------------------------
-- 1. vendor_connections
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vendor_connection_status') then
    create type public.vendor_connection_status as enum ('pending', 'connected', 'ignored');
  end if;
end $$;

create table if not exists public.vendor_connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status public.vendor_connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_connections_no_self check (sender_id <> receiver_id)
);

comment on table public.vendor_connections is
  'B2B V2V/F2V connection requests between vendor and farmer profiles.';

-- Unordered unique pair (A↔ B) in either direction
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

-- Roles must be vendor or farmer
create or replace function public.is_b2b_network_role(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id and role in ('vendor', 'farmer')
  );
$$;

revoke all on function public.is_b2b_network_role(uuid) from public;
grant execute on function public.is_b2b_network_role(uuid) to authenticated;

create or replace function public.enforce_vendor_connection_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_b2b_network_role(new.sender_id) then
    raise exception 'sender_id must be a vendor or farmer profile';
  end if;
  if not public.is_b2b_network_role(new.receiver_id) then
    raise exception 'receiver_id must be a vendor or farmer profile';
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_connections_enforce_roles on public.vendor_connections;
create trigger vendor_connections_enforce_roles
  before insert or update of sender_id, receiver_id
  on public.vendor_connections
  for each row execute function public.enforce_vendor_connection_roles();

alter table public.vendor_connections enable row level security;

drop policy if exists "B2B peers read own connections" on public.vendor_connections;
create policy "B2B peers read own connections"
  on public.vendor_connections for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "B2B peers send connection requests" on public.vendor_connections;
create policy "B2B peers send connection requests"
  on public.vendor_connections for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_b2b_network_role(sender_id)
    and public.is_b2b_network_role(receiver_id)
  );

drop policy if exists "B2B peers update own connections" on public.vendor_connections;
create policy "B2B peers update own connections"
  on public.vendor_connections for update
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "B2B sender delete pending" on public.vendor_connections;
create policy "B2B sender delete pending"
  on public.vendor_connections for delete
  to authenticated
  using (sender_id = auth.uid() and status = 'pending');

-- Migrate draft network_connections → vendor_connections when present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'network_connections'
  ) then
    insert into public.vendor_connections (id, sender_id, receiver_id, status, created_at, updated_at)
    select
      nc.id,
      nc.sender_id,
      nc.receiver_id,
      case
        when nc.status = 'connected' then 'connected'::public.vendor_connection_status
        else 'pending'::public.vendor_connection_status
      end,
      nc.created_at,
      coalesce(nc.updated_at, nc.created_at)
    from public.network_connections nc
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. B2B messaging — extend conversation_threads
-- ---------------------------------------------------------------------------

alter table public.conversation_threads
  add column if not exists b2b_peer_user_id uuid references public.profiles (id) on delete set null;

alter table public.conversation_threads
  add column if not exists vendor_connection_id uuid references public.vendor_connections (id) on delete set null;

alter table public.conversation_threads
  drop constraint if exists conversation_threads_one_counterparty_chk;

alter table public.conversation_threads
  add constraint conversation_threads_one_counterparty_chk check (
    (vendor_id is not null)::int
      + (chef_id is not null)::int
      + (b2b_peer_user_id is not null)::int = 1
  );

create unique index if not exists conversation_threads_vendor_connection_uidx
  on public.conversation_threads (vendor_connection_id)
  where vendor_connection_id is not null;

create index if not exists conversation_threads_b2b_peer_idx
  on public.conversation_threads (b2b_peer_user_id, last_message_at desc)
  where b2b_peer_user_id is not null;

-- Refresh RLS for B2B participants
drop policy if exists "Participants read conversation threads" on public.conversation_threads;
create policy "Participants read conversation threads"
  on public.conversation_threads for select
  using (
    auth.uid() = customer_user_id
    or auth.uid() = b2b_peer_user_id
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or chef_id in (select id from public.chefs where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Customers create conversation threads" on public.conversation_threads;
drop policy if exists "Participants create conversation threads" on public.conversation_threads;
create policy "Participants create conversation threads"
  on public.conversation_threads for insert
  with check (
    auth.uid() = customer_user_id
    or auth.uid() = b2b_peer_user_id
  );

drop policy if exists "Participants update conversation threads" on public.conversation_threads;
create policy "Participants update conversation threads"
  on public.conversation_threads for update
  using (
    auth.uid() = customer_user_id
    or auth.uid() = b2b_peer_user_id
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or chef_id in (select id from public.chefs where user_id = auth.uid())
  );

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select
  using (
    thread_id in (
      select id from public.conversation_threads
      where customer_user_id = auth.uid()
         or b2b_peer_user_id = auth.uid()
         or vendor_id in (select id from public.vendors where user_id = auth.uid())
         or chef_id in (select id from public.chefs where user_id = auth.uid())
         or public.is_admin()
    )
  );

drop policy if exists "Participants insert messages" on public.messages;
create policy "Participants insert messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_user_id
    and thread_id in (
      select id from public.conversation_threads
      where customer_user_id = auth.uid()
         or b2b_peer_user_id = auth.uid()
         or vendor_id in (select id from public.vendors where user_id = auth.uid())
         or chef_id in (select id from public.chefs where user_id = auth.uid())
    )
  );

-- Initialize B2B thread when a connection becomes connected
create or replace function public.ensure_b2b_conversation_thread(p_connection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conn record;
  existing_id uuid;
  new_id uuid;
  left_id uuid;
  right_id uuid;
begin
  select * into conn from public.vendor_connections where id = p_connection_id;
  if not found then
    raise exception 'connection not found';
  end if;
  if conn.status <> 'connected' then
    raise exception 'connection must be connected to open a thread';
  end if;

  select id into existing_id
  from public.conversation_threads
  where vendor_connection_id = p_connection_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  -- Stable ordering for participant columns
  if conn.sender_id::text < conn.receiver_id::text then
    left_id := conn.sender_id;
    right_id := conn.receiver_id;
  else
    left_id := conn.receiver_id;
    right_id := conn.sender_id;
  end if;

  insert into public.conversation_threads (
    customer_user_id,
    b2b_peer_user_id,
    vendor_connection_id,
    subject
  )
  values (
    left_id,
    right_id,
    p_connection_id,
    'B2B network chat'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.ensure_b2b_conversation_thread(uuid) from public;
grant execute on function public.ensure_b2b_conversation_thread(uuid) to authenticated;

create or replace function public.vendor_connections_open_thread_on_connect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'connected' and (tg_op = 'INSERT' or old.status is distinct from 'connected') then
    perform public.ensure_b2b_conversation_thread(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_connections_open_thread on public.vendor_connections;
create trigger vendor_connections_open_thread
  after insert or update of status
  on public.vendor_connections
  for each row execute function public.vendor_connections_open_thread_on_connect();
