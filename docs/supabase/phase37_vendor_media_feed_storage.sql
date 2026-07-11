-- Vendorly Phase 37 — vendor media feed storage
-- Run in Supabase SQL Editor after phase36_production_mvp_core_schema.sql.
--
-- Public bucket for vendor feed images/videos. The backend `/api/vendor/upload`
-- endpoint enforces stricter per-kind limits (5MB images, 50MB videos) before
-- issuing signed upload tokens; this bucket-level cap prevents oversized videos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-media-feed',
  'vendor-media-feed',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Vendors upload signed feed media" on storage.objects;
create policy "Vendors upload signed feed media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-media-feed'
    and exists (
      select 1
      from public.vendors v
      where v.user_id = auth.uid()
        and v.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Public read vendor feed media" on storage.objects;
create policy "Public read vendor feed media"
  on storage.objects for select
  using (bucket_id = 'vendor-media-feed');

drop policy if exists "Vendors update own feed media" on storage.objects;
create policy "Vendors update own feed media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vendor-media-feed'
    and exists (
      select 1
      from public.vendors v
      where v.user_id = auth.uid()
        and v.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Vendors delete own feed media" on storage.objects;
create policy "Vendors delete own feed media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-media-feed'
    and exists (
      select 1
      from public.vendors v
      where v.user_id = auth.uid()
        and v.id::text = (storage.foldername(name))[1]
    )
  );
