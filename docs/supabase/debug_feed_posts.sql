-- Debug: why a vendor post may not appear in the shopper feed
-- Run in Supabase SQL Editor (bypasses RLS).

-- 1) Recent posts + vendor approval + location
select
  p.id,
  left(p.caption, 60) as caption,
  p.publish_at,
  p.publish_at <= now() as is_live,
  v.business_name,
  v.approval_status,
  v.sell_city,
  v.sell_state
from public.posts p
join public.vendors v on v.id = p.vendor_id
order by p.created_at desc
limit 20;

-- 2) Replace with your shopper email to see saved vendors + location
-- select u.email, u.city, u.state, u.zip_code, s.saved_vendors, s.default_location
-- from public.users u
-- join public.shoppers s on s.user_id = u.id
-- where u.email = 'shopper@example.com';

-- 3) Confirm explore RLS policy exists
-- select policyname from pg_policies where tablename = 'posts';
