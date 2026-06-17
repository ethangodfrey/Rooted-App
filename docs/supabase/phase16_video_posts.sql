-- Rooted Phase 16: vendor video posts
-- Run in Supabase SQL Editor after Phase 10 (posts) and Phase 7 (product-media storage).
-- Adds media_type so posts can be photos or videos; videos reuse the product-media bucket.

alter table public.posts
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));

alter table public.posts
  add column if not exists video_thumbnail_url text;

create index if not exists posts_vendor_media_type_idx
  on public.posts (vendor_id, media_type, publish_at desc);

-- Videos are stored under {user_id}/videos/ in the existing product-media bucket.
-- In Supabase Dashboard → Storage → product-media, consider raising the file size limit
-- (e.g. 50 MB) if vendors upload longer clips.
