-- Vendorly Marketplace — Phase 23c (Verification document storage)
-- Run in Supabase SQL Editor AFTER phase23_vendorly_enhanced.sql.
--
-- Safe to RE-RUN (policies use DROP IF EXISTS, bucket insert uses ON CONFLICT).
-- Adds a PRIVATE storage bucket for verification credential documents
-- (cottage food permits, business licenses, food handler cards, insurance, etc.)
-- and scopes access so a creator can manage only their own folder while
-- admins can read every document for review.
--
-- `verification_credentials.document_url` already exists (phase23) and stores
-- the storage object PATH (e.g. <uid>/cottage_food_permit-<ts>.jpg). The mobile
-- client resolves it to a short-lived signed URL on demand — do not expect a
-- public URL here, the bucket is private.

-- ---------------------------------------------------------------------------
-- Private bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Owners can upload only into their own folder: <uid>/<file>.
drop policy if exists "Users upload own verification docs" on storage.objects;
create policy "Users upload own verification docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners read their own documents; admins read everything for review.
drop policy if exists "Users read own verification docs" on storage.objects;
create policy "Users read own verification docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Owners can replace their own documents (e.g. re-upload before review).
drop policy if exists "Users update own verification docs" on storage.objects;
create policy "Users update own verification docs"
  on storage.objects for update to authenticated
  using (bucket_id = 'verification-docs' and owner = auth.uid());

-- Owners can delete their own documents; admins can clean up any document.
drop policy if exists "Users delete own verification docs" on storage.objects;
create policy "Users delete own verification docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (owner = auth.uid() or public.is_admin())
  );

comment on column public.verification_credentials.document_url is
  'Storage object path in the private verification-docs bucket; client resolves to a signed URL.';
