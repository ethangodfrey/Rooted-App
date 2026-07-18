-- Rooted — Real-Time Notification Center (2026-07-18)
-- Apply after 20260717_preorders_pickup.sql and 20260717_b2b_connections.sql
-- (+ phase51 profiles).
--
-- Asynchronous notification_logs for transactional milestones
-- (pre-order status changes, B2B connection requests) with Realtime inserts.

-- ---------------------------------------------------------------------------
-- 1. Enum + table
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_type'
  ) then
    create type public.notification_type as enum (
      'ORDER_STATUS',
      'CONNECTION_REQUEST',
      'SYSTEM_ALERT'
    );
  end if;
end $$;

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  notification_type public.notification_type not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notification_logs_title_not_blank check (char_length(btrim(title)) > 0),
  constraint notification_logs_body_not_blank check (char_length(btrim(body)) > 0)
);

comment on table public.notification_logs is
  'Async alert log for order milestones, B2B handshakes, and system alerts.';

create index if not exists notification_logs_user_created_idx
  on public.notification_logs (user_id, created_at desc);

create index if not exists notification_logs_user_unread_idx
  on public.notification_logs (user_id, created_at desc)
  where is_read = false;

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

alter table public.notification_logs enable row level security;

drop policy if exists "Users read own notification logs" on public.notification_logs;
create policy "Users read own notification logs"
  on public.notification_logs for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own notification logs" on public.notification_logs;
create policy "Users update own notification logs"
  on public.notification_logs for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Inserts come from security definer triggers / service role only.
drop policy if exists "No direct client inserts on notification logs" on public.notification_logs;
-- (intentionally no INSERT policy for authenticated clients)

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type public.notification_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notification_logs (
    user_id,
    title,
    body,
    notification_type
  ) values (
    p_user_id,
    upper(btrim(p_title)),
    btrim(p_body),
    p_type
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, public.notification_type) from public;
grant execute on function public.enqueue_notification(uuid, text, text, public.notification_type) to service_role;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notification_logs
  set is_read = true
  where user_id = auth.uid()
    and is_read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trigger: preorder_orders status milestones → ORDER_STATUS
-- ---------------------------------------------------------------------------

create or replace function public.notify_preorder_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_code text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_code := coalesce(new.pickup_code, 'PENDING');

  if tg_op = 'INSERT' then
    v_title := 'ORDER_PLACED';
    v_body := format(
      'PRE-ORDER %s CREATED · STATUS %s · PAYMENT %s',
      v_code,
      new.status::text,
      new.payment_status::text
    );
  elsif new.status = 'PENDING_PICKUP' then
    v_title := 'ORDER_READY';
    v_body := format(
      'PRE-ORDER %s AWAITING PICKUP · PAYMENT %s',
      v_code,
      new.payment_status::text
    );
  elsif new.status = 'COMPLETED' then
    v_title := 'ORDER_COMPLETED';
    v_body := format(
      'PRE-ORDER %s MARKED COMPLETED · PAYMENT %s',
      v_code,
      new.payment_status::text
    );
  elsif new.status = 'CANCELLED' then
    v_title := 'ORDER_CANCELLED';
    v_body := format('PRE-ORDER %s CANCELLED', v_code);
  else
    v_title := 'ORDER_STATUS';
    v_body := format(
      'PRE-ORDER %s STATUS %s',
      v_code,
      new.status::text
    );
  end if;

  perform public.enqueue_notification(
    new.shopper_id,
    v_title,
    v_body,
    'ORDER_STATUS'::public.notification_type
  );

  if new.vendor_id is distinct from new.shopper_id then
    perform public.enqueue_notification(
      new.vendor_id,
      v_title,
      v_body,
      'ORDER_STATUS'::public.notification_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists preorder_orders_notify_status on public.preorder_orders;
create trigger preorder_orders_notify_status
  after insert or update of status on public.preorder_orders
  for each row
  execute function public.notify_preorder_status_change();

-- ---------------------------------------------------------------------------
-- 5. Trigger: B2B connection handshake → CONNECTION_REQUEST / SYSTEM_ALERT
-- ---------------------------------------------------------------------------

create or replace function public.notify_vendor_connection_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.enqueue_notification(
        new.receiver_id,
        'CONNECTION_REQUEST',
        'NEW B2B NETWORK REQUEST AWAITING REVIEW',
        'CONNECTION_REQUEST'::public.notification_type
      );
    end if;
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'pending' and old.status is distinct from 'pending' then
    perform public.enqueue_notification(
      new.receiver_id,
      'CONNECTION_REQUEST',
      'B2B NETWORK REQUEST UPDATED TO PENDING',
      'CONNECTION_REQUEST'::public.notification_type
    );
  elsif new.status = 'connected' then
    perform public.enqueue_notification(
      new.sender_id,
      'CONNECTION_ACCEPTED',
      'B2B NETWORK CONNECTION IS NOW ACTIVE',
      'SYSTEM_ALERT'::public.notification_type
    );
    perform public.enqueue_notification(
      new.receiver_id,
      'CONNECTION_ACCEPTED',
      'B2B NETWORK CONNECTION IS NOW ACTIVE',
      'SYSTEM_ALERT'::public.notification_type
    );
  elsif new.status = 'ignored' then
    perform public.enqueue_notification(
      new.sender_id,
      'CONNECTION_IGNORED',
      'B2B NETWORK REQUEST WAS DECLINED',
      'SYSTEM_ALERT'::public.notification_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vendor_connections_notify on public.vendor_connections;
create trigger vendor_connections_notify
  after insert or update of status on public.vendor_connections
  for each row
  execute function public.notify_vendor_connection_change();

-- ---------------------------------------------------------------------------
-- 6. Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notification_logs;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;
