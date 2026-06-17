-- Rooted: delete all test vendors and reset for a fresh pilot run
-- Run in Supabase SQL Editor (postgres role).
-- Admins are never touched.

-- ---------------------------------------------------------------------------
-- 1) Preview what will be removed
-- ---------------------------------------------------------------------------
select v.id, v.business_name, v.approval_status, u.email, u.role
from public.vendors v
join public.users u on u.id = v.user_id
order by v.created_at desc;

-- ---------------------------------------------------------------------------
-- 2) Delete all vendor rows (cascades products, orders, posts, POS, etc.)
-- ---------------------------------------------------------------------------
delete from public.vendors;

-- ---------------------------------------------------------------------------
-- 3) Reset vendor user accounts so they can pick a role again on next sign-in
--    (does not delete auth accounts — same email/password still works)
-- ---------------------------------------------------------------------------
update public.users
set role = null,
    updated_at = now()
where role = 'vendor';

-- ---------------------------------------------------------------------------
-- 4) Clear saved-vendor favorites (IDs are now stale)
-- ---------------------------------------------------------------------------
update public.shoppers
set saved_vendors = '{}'
where coalesce(array_length(saved_vendors, 1), 0) > 0;

-- ---------------------------------------------------------------------------
-- 5) Verify
-- ---------------------------------------------------------------------------
select count(*) as remaining_vendors from public.vendors;
select id, email, role from public.users where role = 'vendor';
select id, email, role from public.users where role = 'admin';

-- ---------------------------------------------------------------------------
-- OPTIONAL: fully delete vendor auth accounts (re-signup with same email)
-- Uncomment ONLY if you want accounts removed from Authentication entirely.
-- Admins are still excluded.
-- ---------------------------------------------------------------------------
-- delete from auth.users
-- where id in (
--   select u.id
--   from public.users u
--   where u.role is null
--     and u.id not in (select id from public.users where role = 'admin')
--     and not exists (select 1 from public.shoppers s where s.user_id = u.id)
--     and not exists (select 1 from public.vendors v where v.user_id = u.id)
-- );
