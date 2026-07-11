-- Vendorly Phase 33 — Hybrid Explore feed (geo + engagement ranking)
-- Run in Supabase SQL Editor after phase31_leftovers_search.sql.
--
-- Combines vendor storefront posts and explore showcase media into one feed
-- ranked by proximity and popularity:
--   hybrid_score = (likes_weight * total_likes) - (distance_weight * distance_miles)
--
-- Callable via supabase.rpc('explore_hybrid_feed', ...) or tenant-web GET /api/explore/feed.
-- Requires PostGIS (phase24) and explore_content (phase22).

-- ---------------------------------------------------------------------------
-- RPC: hybrid explore feed with cursor pagination
-- ---------------------------------------------------------------------------
create or replace function public.explore_hybrid_feed(
  p_lat              double precision,
  p_lng              double precision,
  p_radius_miles     double precision default 25,
  p_likes_weight     double precision default 1.0,
  p_distance_weight  double precision default 2.0,
  p_limit            integer default 20,
  p_cursor           text default null
)
returns table (
  item_type            text,
  item_id              uuid,
  creator_type         text,
  vendor_id            uuid,
  chef_id              uuid,
  creator_name         text,
  creator_avatar_url   text,
  sell_city            text,
  sell_state           text,
  title                text,
  caption              text,
  media_url            text,
  media_urls           text[],
  content_kind         text,
  media_type           text,
  video_thumbnail_url  text,
  total_likes          integer,
  distance_miles       double precision,
  hybrid_score         double precision,
  created_at           timestamptz,
  next_cursor          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_radius_miles     double precision;
  v_limit            integer;
  v_cursor_score     double precision;
  v_cursor_created   timestamptz;
  v_cursor_id        uuid;
  v_last_score       double precision;
  v_last_created     timestamptz;
  v_last_id          uuid;
begin
  if p_lat is null or p_lng is null then
    raise exception 'p_lat and p_lng are required';
  end if;

  v_radius_miles := greatest(15.0, least(50.0, coalesce(p_radius_miles, 25.0)));
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  if p_cursor is not null and btrim(p_cursor) <> '' then
    begin
      v_cursor_score := nullif(split_part(p_cursor, '|', 1), '')::double precision;
      v_cursor_created := nullif(split_part(p_cursor, '|', 2), '')::timestamptz;
      v_cursor_id := nullif(split_part(p_cursor, '|', 3), '')::uuid;
    exception
      when others then
        raise exception 'Invalid p_cursor token';
    end;
  end if;

  return query
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  ),
  candidates as (
    -- Vendor social posts (approved vendors, published + moderated)
    select
      'vendor_post'::text as item_type,
      p.id as item_id,
      'vendor'::text as creator_type,
      v.id as vendor_id,
      null::uuid as chef_id,
      v.business_name as creator_name,
      v.logo_url as creator_avatar_url,
      v.sell_city,
      v.sell_state,
      null::text as title,
      p.caption,
      p.media_url,
      case
        when p.media_url is not null then array[p.media_url]
        else '{}'::text[]
      end as media_urls,
      p.post_type::text as content_kind,
      coalesce(p.media_type, 'image')::text as media_type,
      p.video_thumbnail_url,
      (
        select count(*)::integer
        from public.saved_items si
        where si.item_type = 'vendor'
          and si.vendor_id = v.id
      ) as total_likes,
      coalesce(p.publish_at, p.created_at) as created_at,
      v.geog as creator_geog
    from public.posts p
    inner join public.vendors v on v.id = p.vendor_id
    where coalesce(p.publish_at, p.created_at) <= now()
      and coalesce(p.moderation_status, 'approved') = 'approved'
      and v.approval_status = 'approved'
      and v.geog is not null

    union all

    -- Explore showcase content (vendors + chefs)
    select
      'showcase'::text as item_type,
      ec.id as item_id,
      ec.creator_type::text as creator_type,
      ec.vendor_id,
      ec.chef_id,
      coalesce(v.business_name, c.display_name) as creator_name,
      coalesce(v.logo_url, c.profile_photo_url) as creator_avatar_url,
      coalesce(v.sell_city, c.home_base_city) as sell_city,
      coalesce(v.sell_state, c.home_base_state) as sell_state,
      ec.title,
      ec.caption,
      case
        when coalesce(array_length(ec.media_urls, 1), 0) > 0 then ec.media_urls[1]
        else null
      end as media_url,
      coalesce(ec.media_urls, '{}'::text[]) as media_urls,
      ec.content_type::text as content_kind,
      'image'::text as media_type,
      null::text as video_thumbnail_url,
      greatest(ec.engagement_count, 0) as total_likes,
      ec.created_at,
      coalesce(v.geog, c.geog) as creator_geog
    from public.explore_content ec
    left join public.vendors v
      on ec.vendor_id = v.id
     and v.approval_status = 'approved'
    left join public.chefs c
      on ec.chef_id = c.id
     and c.approval_status = 'approved'
    where (
      (ec.vendor_id is not null and v.id is not null)
      or (ec.chef_id is not null and c.id is not null)
    )
    and coalesce(v.geog, c.geog) is not null
  ),
  scored as (
    select
      c.*,
      (st_distance(c.creator_geog, origin.g) / 1609.344)::double precision as distance_miles,
      (
        (coalesce(p_likes_weight, 1.0) * c.total_likes::double precision)
        - (coalesce(p_distance_weight, 2.0) * (st_distance(c.creator_geog, origin.g) / 1609.344))
      )::double precision as hybrid_score
    from candidates c, origin
    where st_dwithin(c.creator_geog, origin.g, v_radius_miles * 1609.344)
  ),
  ranked as (
    select s.*
    from scored s
    where (
      v_cursor_score is null
      or s.hybrid_score < v_cursor_score
      or (
        s.hybrid_score = v_cursor_score
        and (
          s.created_at < v_cursor_created
          or (s.created_at = v_cursor_created and s.item_id < v_cursor_id)
        )
      )
    )
    order by s.hybrid_score desc, s.created_at desc, s.item_id desc
    limit v_limit + 1
  ),
  paged as (
    select
      r.*,
      row_number() over (order by r.hybrid_score desc, r.created_at desc, r.item_id desc) as rn,
      count(*) over () as total_fetched
    from ranked r
  )
  select
    p.item_type,
    p.item_id,
    p.creator_type,
    p.vendor_id,
    p.chef_id,
    p.creator_name,
    p.creator_avatar_url,
    p.sell_city,
    p.sell_state,
    p.title,
    p.caption,
    p.media_url,
    p.media_urls,
    p.content_kind,
    p.media_type,
    p.video_thumbnail_url,
    p.total_likes,
    p.distance_miles,
    p.hybrid_score,
    p.created_at,
    case
      when p.total_fetched > v_limit and p.rn = v_limit
        then p.hybrid_score::text || '|' || p.created_at::text || '|' || p.item_id::text
      else null
    end as next_cursor
  from paged p
  where p.rn <= v_limit;

end;
$$;

comment on function public.explore_hybrid_feed is
  'Hybrid explore feed: vendor posts + showcase media within radius, ranked by likes minus distance penalty.';

grant execute on function public.explore_hybrid_feed(
  double precision,
  double precision,
  double precision,
  double precision,
  double precision,
  integer,
  text
) to anon, authenticated, service_role;
