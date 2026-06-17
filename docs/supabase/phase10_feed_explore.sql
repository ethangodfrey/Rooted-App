-- Rooted: shopper explore feed (posts from approved vendors)
-- Run in Supabase SQL Editor after phase10_post_scheduling.sql.
--
-- Lets signed-in shoppers read published posts from any approved vendor
-- when using Explore mode. Saved-vendor posts still work via the existing policy.

drop policy if exists "Shoppers explore approved vendor posts" on public.posts;

create policy "Shoppers explore approved vendor posts"
  on public.posts for select
  using (
    publish_at <= now()
    and exists (
      select 1
      from public.vendors v
      where v.id = posts.vendor_id
        and v.approval_status = 'approved'
    )
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'shopper'
    )
  );
