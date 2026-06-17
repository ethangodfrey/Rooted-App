-- Rooted: let shoppers read vendor profiles they have saved (any approval status)
-- Run in Supabase SQL Editor after phase1_auth.sql.
--
-- Without this, saved-vendor posts can load but the vendor embed is null when the
-- vendor is still pending approval — the feed then drops those posts client-side.

drop policy if exists "Shoppers read saved vendor profiles" on public.vendors;

create policy "Shoppers read saved vendor profiles"
  on public.vendors for select
  using (
    exists (
      select 1
      from public.shoppers s
      where s.user_id = auth.uid()
        and vendors.id = any (s.saved_vendors)
    )
  );
