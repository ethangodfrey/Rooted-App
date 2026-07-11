-- Vendorly Phase 35 — hyper-local velocity recommendation feed
-- Run in Supabase SQL Editor after phase34_vendor_media_feed_storage.sql.
--
-- Caches post/vendor engagement features every 15 minutes, then applies
-- per-request PostGIS distance scoring through get_ranked_vendor_feed().

create extension if not exists postgis;

drop materialized view if exists public.vendor_feed_rank_cache;

create materialized view public.vendor_feed_rank_cache as
with vendor_saves as (
  select vendor_id, count(*)::integer as saves_count
  from public.saved_items
  where item_type = 'vendor' and vendor_id is not null
  group by vendor_id
),
today_events as (
  select distinct on (ve.vendor_id)
    ve.vendor_id,
    e.id as event_id,
    e.name as event_name,
    e.latitude,
    e.longitude,
    e.geog
  from public.vendor_events ve
  join public.events e on e.id = ve.event_id
  where ve.participation_status = 'approved'
    and e.visibility_status = 'public'
    and now() between date_trunc('day', e.start_datetime)
                and date_trunc('day', e.start_datetime) + interval '1 day'
  order by ve.vendor_id, e.start_datetime asc
)
select
  p.id,
  p.vendor_id,
  p.post_type,
  coalesce(p.content, p.caption) as content,
  p.caption,
  p.media_url,
  p.media_type,
  p.video_thumbnail_url,
  p.publish_at,
  p.created_at,
  v.business_name,
  v.category,
  v.sell_city,
  v.sell_state,
  coalesce(te.latitude, v.latitude) as latitude,
  coalesce(te.longitude, v.longitude) as longitude,
  coalesce(te.geog, v.geog) as geog,
  te.event_id,
  te.event_name,
  (te.event_id is not null) as active_today,
  coalesce(vs.saves_count, 0) as saves_count,
  0::integer as likes_count,
  case
    when p.created_at >= now() - interval '24 hours' then 1.0
    when p.created_at <= now() - interval '7 days' then 0.0
    else greatest(0.0, extract(epoch from ((p.created_at + interval '7 days') - now())) / extract(epoch from interval '6 days'))
  end as freshness_multiplier
from public.posts p
join public.vendors v on v.id = p.vendor_id and v.approval_status = 'approved'
left join vendor_saves vs on vs.vendor_id = p.vendor_id
left join today_events te on te.vendor_id = p.vendor_id
where p.publish_at <= now();

create unique index vendor_feed_rank_cache_id_uidx
  on public.vendor_feed_rank_cache (id);

create index vendor_feed_rank_cache_created_idx
  on public.vendor_feed_rank_cache (created_at desc);

create index vendor_feed_rank_cache_geog_gist
  on public.vendor_feed_rank_cache using gist (geog);

create or replace function public.refresh_vendor_feed_rank_cache()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.vendor_feed_rank_cache;
$$;

create or replace function public.get_ranked_vendor_feed(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 40
)
returns table (
  id uuid,
  vendor_id uuid,
  post_type text,
  content text,
  caption text,
  media_url text,
  media_type text,
  video_thumbnail_url text,
  publish_at timestamptz,
  created_at timestamptz,
  business_name text,
  category text,
  sell_city text,
  sell_state text,
  event_id uuid,
  event_name text,
  distance_miles double precision,
  score double precision,
  priority_flags text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select case
      when p_lat is not null and p_lng is not null
        then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      else null
    end as geog
  ),
  scored as (
    select
      c.*,
      case
        when origin.geog is not null and c.geog is not null
          then st_distancesphere(c.geog::geometry, origin.geog::geometry) / 1609.344
        else 25.0
      end as distance_miles,
      (
        (
          ((c.saves_count * 3) + (c.likes_count * 1) + (c.freshness_multiplier * 5))
          / power(greatest(
              case
                when origin.geog is not null and c.geog is not null
                  then st_distancesphere(c.geog::geometry, origin.geog::geometry) / 1609.344
                else 25.0
              end,
              0.5
            ), 2)
        )
        * case when c.active_today then 1.2 else 1.0 end
      )::double precision as score
    from public.vendor_feed_rank_cache c
    cross join origin
  )
  select
    scored.id,
    scored.vendor_id,
    scored.post_type,
    scored.content,
    scored.caption,
    scored.media_url,
    scored.media_type,
    scored.video_thumbnail_url,
    scored.publish_at,
    scored.created_at,
    scored.business_name,
    scored.category,
    scored.sell_city,
    scored.sell_state,
    scored.event_id,
    scored.event_name,
    scored.distance_miles,
    scored.score,
    array_remove(array[
      case when scored.distance_miles < 2 then '📍 Less than 2 miles away' end,
      case when (scored.saves_count * 3 + scored.likes_count) >= 5 then '🔥 Trending This Week' end,
      case when scored.freshness_multiplier >= 1 then '✨ New Update' end,
      case when scored.active_today then '🧺 At market today' end
    ], null) as priority_flags
  from scored
  order by scored.score desc, scored.created_at desc
  limit greatest(coalesce(p_limit, 40), 1);
$$;

grant execute on function public.get_ranked_vendor_feed(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.refresh_vendor_feed_rank_cache() to authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege or undefined_file then
      null;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('vendor-feed-rank-cache-15m');
    perform cron.schedule(
      'vendor-feed-rank-cache-15m',
      '*/15 * * * *',
      'select public.refresh_vendor_feed_rank_cache();'
    );
  end if;
exception
  when undefined_function then null;
end $$;
