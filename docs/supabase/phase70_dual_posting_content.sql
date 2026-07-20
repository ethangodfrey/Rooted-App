-- Phase 70 — Dual-posting content contributions (farmer + vendor)
-- Apply after phase10_posts (+ phase16 video, phase19 moderation) and
-- phase51_network_and_stickers (network_connections).
--
-- Adds contributor attribution, partnership posting mode, co-approval,
-- and appendable contribution rows for joint farmer/vendor updates.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'post_contributor_type'
  ) then
    create type public.post_contributor_type as enum ('FARMER', 'VENDOR');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'post_content_type'
  ) then
    create type public.post_content_type as enum ('TEXT', 'PHOTO', 'VIDEO');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'post_posting_mode'
  ) then
    create type public.post_posting_mode as enum ('SELF', 'PARTNERSHIP');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'post_co_approval_status'
  ) then
    create type public.post_co_approval_status as enum (
      'NONE',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'APPENDED'
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_type'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_type'
      and e.enumlabel = 'CONTENT_CONTRIBUTION'
  ) then
    alter type public.notification_type add value 'CONTENT_CONTRIBUTION';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Extend posts
-- ---------------------------------------------------------------------------

alter table public.posts
  add column if not exists contributor_id uuid;

alter table public.posts
  add column if not exists contributor_type public.post_contributor_type;

alter table public.posts
  add column if not exists content_type public.post_content_type
    not null default 'TEXT'::public.post_content_type;

alter table public.posts
  add column if not exists posting_mode public.post_posting_mode
    not null default 'SELF'::public.post_posting_mode;

-- Prefer canonical vendor_connections (20260717); fall back to network_connections.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'partnership_connection_id'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'vendor_connections'
    ) then
      alter table public.posts
        add column partnership_connection_id uuid
          references public.vendor_connections (id) on delete set null;
    elsif exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'network_connections'
    ) then
      alter table public.posts
        add column partnership_connection_id uuid
          references public.network_connections (id) on delete set null;
    else
      alter table public.posts
        add column partnership_connection_id uuid;
    end if;
  end if;
end $$;

alter table public.posts
  add column if not exists partner_contributor_id uuid;

alter table public.posts
  add column if not exists partner_contributor_type public.post_contributor_type;

alter table public.posts
  add column if not exists co_approval_status public.post_co_approval_status
    not null default 'NONE'::public.post_co_approval_status;

alter table public.posts
  add column if not exists cdn_media_url text;

alter table public.posts
  add column if not exists media_compressed boolean not null default false;

alter table public.posts
  add column if not exists contribution_metadata jsonb not null default '{}'::jsonb;

comment on column public.posts.contributor_id is
  'Primary author profile/vendor/farmer id for dual-post attribution.';
comment on column public.posts.contribution_metadata is
  'JSON attribution blob: parties[], posting_mode, content_type, media.';

create index if not exists posts_contributor_idx
  on public.posts (contributor_id, contributor_type);

create index if not exists posts_partnership_idx
  on public.posts (partnership_connection_id)
  where partnership_connection_id is not null;

create index if not exists posts_co_approval_pending_idx
  on public.posts (co_approval_status)
  where co_approval_status = 'PENDING'::public.post_co_approval_status;

-- Backfill contributor from vendor owner when unset.
update public.posts p
set
  contributor_id = coalesce(p.contributor_id, p.vendor_id),
  contributor_type = coalesce(p.contributor_type, 'VENDOR'::public.post_contributor_type)
where p.contributor_id is null;

-- ---------------------------------------------------------------------------
-- 3. Appendable contributions (partner co-approve / append)
-- ---------------------------------------------------------------------------

create table if not exists public.post_contributions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  contributor_id uuid not null,
  contributor_type public.post_contributor_type not null,
  content_type public.post_content_type not null default 'TEXT'::public.post_content_type,
  body text,
  media_url text,
  cdn_media_url text,
  media_compressed boolean not null default false,
  action text not null
    check (action in ('CREATE', 'CO_APPROVE', 'APPEND', 'REJECT')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists post_contributions_post_idx
  on public.post_contributions (post_id, created_at desc);

alter table public.post_contributions enable row level security;

drop policy if exists "Contributors read post contributions" on public.post_contributions;
create policy "Contributors read post contributions"
  on public.post_contributions for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_contributions.post_id
        and (
          p.vendor_id in (select id from public.vendors where user_id = auth.uid())
          or p.contributor_id = auth.uid()
          or p.partner_contributor_id = auth.uid()
        )
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. Notify partner on partnership post
-- ---------------------------------------------------------------------------

create or replace function public.notify_partnership_content_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_user uuid;
  title text := 'CONTENT_CONTRIBUTION';
  body text;
begin
  if new.posting_mode <> 'PARTNERSHIP'::public.post_posting_mode then
    return new;
  end if;
  if new.partner_contributor_id is null then
    return new;
  end if;

  -- Prefer profile id as notification user; fall back to vendor.user_id / farmer.user_id.
  partner_user := new.partner_contributor_id;

  select coalesce(v.user_id, f.user_id, partner_user)
  into partner_user
  from (select new.partner_contributor_id as id) x
  left join public.vendors v on v.id = x.id
  left join public.farmers f on f.id = x.id;

  body := format(
    'PARTNERSHIP POST PENDING CO-APPROVAL POST=%s CONTRIBUTOR=%s',
    new.id::text,
    coalesce(new.contributor_type::text, 'UNKNOWN')
  );

  begin
    perform public.enqueue_notification(
      partner_user,
      title,
      body,
      'CONTENT_CONTRIBUTION'::public.notification_type
    );
  exception
    when others then
      begin
        perform public.enqueue_notification(
          partner_user,
          title,
          body,
          'SYSTEM_ALERT'::public.notification_type
        );
      exception
        when others then
          null;
      end;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_partnership_content_contribution on public.posts;
create trigger trg_notify_partnership_content_contribution
  after insert on public.posts
  for each row
  execute function public.notify_partnership_content_contribution();
