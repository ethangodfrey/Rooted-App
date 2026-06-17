-- Public bucket for auth-redirect.html (email confirm + password reset bridge)
-- Upload docs/supabase/auth-redirect.html to this bucket as auth-redirect.html

insert into storage.buckets (id, name, public)
values ('auth', 'auth', true)
on conflict (id) do update set public = true;

create policy "Public read auth redirect files"
  on storage.objects for select
  using (bucket_id = 'auth');
