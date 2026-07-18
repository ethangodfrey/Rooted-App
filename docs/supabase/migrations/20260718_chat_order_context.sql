-- Rooted — Chat + Pre-Order Context (2026-07-18)
-- Apply after 20260717_preorders_pickup.sql and phase32_stripe_messaging.sql
-- (+ 20260717_b2b_connections.sql for B2B thread columns).
--
-- Links realtime chat messages/threads to open preorder_orders so inboxes
-- can render ORDER_CONTEXT status cards (pickup code, payment, fulfillment).

-- ---------------------------------------------------------------------------
-- 1. messages.associated_order_id → preorder_orders
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists associated_order_id uuid
    references public.preorder_orders (id) on delete set null;

comment on column public.messages.associated_order_id is
  'Optional pre-order context for this message (ORDER_CONTEXT card in chat).';

create index if not exists messages_associated_order_id_idx
  on public.messages (associated_order_id)
  where associated_order_id is not null;

create index if not exists messages_thread_associated_order_idx
  on public.messages (thread_id, associated_order_id)
  where associated_order_id is not null;

-- ---------------------------------------------------------------------------
-- 2. conversation_threads.associated_order_id → preorder_orders
--    Sticky thread-level context (distinct from marketplace order_id).
-- ---------------------------------------------------------------------------

alter table public.conversation_threads
  add column if not exists associated_order_id uuid
    references public.preorder_orders (id) on delete set null;

comment on column public.conversation_threads.associated_order_id is
  'Sticky pre-order context for shopper↔vendor threads (ORDER_CONTEXT).';

create index if not exists conversation_threads_associated_order_id_idx
  on public.conversation_threads (associated_order_id)
  where associated_order_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Helper: open or reuse a shopper↔vendor thread for a pre-order
-- ---------------------------------------------------------------------------

create or replace function public.ensure_preorder_conversation_thread(
  p_preorder_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ord record;
  v_row_id uuid;
  existing_id uuid;
  new_id uuid;
begin
  select *
  into ord
  from public.preorder_orders
  where id = p_preorder_id;

  if not found then
    raise exception 'PREORDER NOT FOUND';
  end if;

  if auth.uid() is distinct from ord.shopper_id
     and auth.uid() is distinct from ord.vendor_id
     and not public.is_admin() then
    raise exception 'NOT AUTHORIZED';
  end if;

  select id into v_row_id
  from public.vendors
  where user_id = ord.vendor_id
  limit 1;

  if v_row_id is null then
    raise exception 'VENDOR ROW NOT FOUND';
  end if;

  select id into existing_id
  from public.conversation_threads
  where associated_order_id = p_preorder_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  select id into existing_id
  from public.conversation_threads
  where customer_user_id = ord.shopper_id
    and vendor_id = v_row_id
    and associated_order_id is null
    and b2b_peer_user_id is null
  order by last_message_at desc
  limit 1;

  if existing_id is not null then
    update public.conversation_threads
    set associated_order_id = p_preorder_id,
        subject = coalesce(subject, 'PRE-ORDER CONTEXT'),
        last_message_at = now()
    where id = existing_id;
    return existing_id;
  end if;

  insert into public.conversation_threads (
    customer_user_id,
    vendor_id,
    associated_order_id,
    subject
  )
  values (
    ord.shopper_id,
    v_row_id,
    p_preorder_id,
    'PRE-ORDER CONTEXT'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.ensure_preorder_conversation_thread(uuid) from public;
grant execute on function public.ensure_preorder_conversation_thread(uuid) to authenticated;
