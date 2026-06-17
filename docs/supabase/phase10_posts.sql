-- Rooted Phase 10: vendor feed (posts)
-- Run in Supabase SQL Editor after Phase 1, 4, 6, 7.
-- Vendors broadcast updates; shoppers who saved the vendor (Phase 8) see them.

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  event_id   uuid references public.events (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  post_type  text not null
    check (post_type in ('promotion', 'launch', 'restock', 'announcement')),
  caption    text not null,
  media_url  text,
  created_at timestamptz not null default now()
);

create index if not exists posts_vendor_idx on public.posts (vendor_id);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

-- Vendors create / edit / delete / read their own posts.
create policy "Vendors manage own posts"
  on public.posts for all
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- Shoppers can read posts only from vendors they have saved.
create policy "Saved shoppers read vendor posts"
  on public.posts for select
  using (
    exists (
      select 1 from public.shoppers s
      where s.user_id = auth.uid()
        and posts.vendor_id = any (s.saved_vendors)
    )
  );
