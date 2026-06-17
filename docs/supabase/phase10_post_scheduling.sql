-- Rooted Phase 10 add-on: scheduled posts
-- Run in Supabase SQL Editor after phase10_posts.sql.
--
-- Adds publish_at so vendors can schedule a post for the future. Shoppers only
-- see a post once publish_at has passed; vendors always see their own.

alter table public.posts
  add column if not exists publish_at timestamptz not null default now();

create index if not exists posts_publish_idx on public.posts (publish_at desc);

-- Time-gate the shopper read policy so scheduled posts stay hidden until due.
drop policy if exists "Saved shoppers read vendor posts" on public.posts;

create policy "Saved shoppers read vendor posts"
  on public.posts for select
  using (
    publish_at <= now()
    and exists (
      select 1 from public.shoppers s
      where s.user_id = auth.uid()
        and posts.vendor_id = any (s.saved_vendors)
    )
  );
