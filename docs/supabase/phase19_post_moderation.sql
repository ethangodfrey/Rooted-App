-- Rooted Phase 19: AI post/video moderation
-- Run in Supabase SQL Editor after phase17/18 admin agent + phase16 video posts.
-- Hides unreviewed/flagged/removed posts from shoppers; admins moderate the queue.

alter table public.posts
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('unreviewed', 'approved', 'flagged', 'removed'));

-- Existing posts stay visible; only new posts after agent is enabled should start unreviewed.
-- To require re-review of all posts: update public.posts set moderation_status = 'unreviewed';

create index if not exists posts_moderation_status_idx
  on public.posts (moderation_status, publish_at desc);

-- ---------------------------------------------------------------------------
-- AI moderation suggestions + admin feedback (training loop)
-- ---------------------------------------------------------------------------

create table if not exists public.post_moderation_suggestions (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.admin_agent_runs (id) on delete set null,
  post_id         uuid not null references public.posts (id) on delete cascade,
  recommendation  text not null
    check (recommendation in ('approve', 'flag', 'remove')),
  confidence      numeric(4, 3) not null default 0.5,
  summary         text not null,
  categories      jsonb not null default '[]'::jsonb,
  flags           jsonb not null default '[]'::jsonb,
  reasons         jsonb not null default '[]'::jsonb,
  agent_version   text,
  created_at      timestamptz not null default now()
);

create index if not exists post_moderation_suggestions_post_idx
  on public.post_moderation_suggestions (post_id, created_at desc);

create table if not exists public.post_moderation_feedback (
  id                 uuid primary key default gen_random_uuid(),
  suggestion_id      uuid references public.post_moderation_suggestions (id) on delete set null,
  post_id            uuid not null references public.posts (id) on delete cascade,
  admin_user_id      uuid not null references public.users (id) on delete cascade,
  ai_recommendation  text
    check (ai_recommendation is null or ai_recommendation in ('approve', 'flag', 'remove')),
  admin_action       text not null
    check (admin_action in ('approved', 'flagged', 'removed')),
  outcome            text not null
    check (outcome in ('accepted', 'overridden', 'no_ai_suggestion')),
  notes              text,
  post_snapshot      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists post_moderation_feedback_created_idx
  on public.post_moderation_feedback (created_at desc);

alter table public.post_moderation_suggestions enable row level security;
alter table public.post_moderation_feedback enable row level security;

create policy "Admins read post moderation suggestions"
  on public.post_moderation_suggestions for select
  using (public.is_admin());

create policy "Admins read post moderation feedback"
  on public.post_moderation_feedback for select
  using (public.is_admin());

create policy "Admins insert post moderation feedback"
  on public.post_moderation_feedback for insert
  with check (public.is_admin() and admin_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin post moderation access
-- ---------------------------------------------------------------------------

create policy "Admins read all posts"
  on public.posts for select
  using (public.is_admin());

create policy "Admins update posts moderation"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete posts"
  on public.posts for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Shoppers only see moderated-approved posts
-- ---------------------------------------------------------------------------

drop policy if exists "Saved shoppers read vendor posts" on public.posts;
create policy "Saved shoppers read vendor posts"
  on public.posts for select
  using (
    moderation_status = 'approved'
    and publish_at <= now()
    and exists (
      select 1 from public.shoppers s
      where s.user_id = auth.uid()
        and posts.vendor_id = any (s.saved_vendors)
    )
  );

drop policy if exists "Shoppers explore approved vendor posts" on public.posts;
create policy "Shoppers explore approved vendor posts"
  on public.posts for select
  using (
    moderation_status = 'approved'
    and publish_at <= now()
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

-- New vendor posts enter the moderation queue (vendors still see their own via existing policy).
alter table public.posts
  alter column moderation_status set default 'unreviewed';
