-- Rooted Phase 7: product media storage bucket
-- Run in Supabase SQL Editor after phase7_products.sql.
-- Creates a public bucket for product photos and scopes writes to each user's
-- own folder (path prefix = auth.uid()).

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

-- Anyone can read product photos (public bucket / public URLs).
create policy "Public read product media"
  on storage.objects for select
  using (bucket_id = 'product-media');

-- Authenticated users can upload only into their own folder: <uid>/<file>.
create policy "Users upload own product media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update/delete their own uploaded objects.
create policy "Users update own product media"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and owner = auth.uid());

create policy "Users delete own product media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and owner = auth.uid());
