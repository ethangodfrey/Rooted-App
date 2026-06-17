-- Rooted Phase 12: let users undo role selection during onboarding
-- Run in Supabase SQL Editor so shoppers/vendors can delete their own extension row.
-- Safe to re-run (drops existing policies first).

drop policy if exists "Shoppers delete own row" on public.shoppers;
create policy "Shoppers delete own row"
  on public.shoppers for delete
  using (auth.uid() = user_id);

drop policy if exists "Vendors delete own row" on public.vendors;
create policy "Vendors delete own row"
  on public.vendors for delete
  using (auth.uid() = user_id);
