-- Rooted Phase 5: local seed events for the Denver, CO metro (ZIP 80125 area)
-- Run in Supabase SQL Editor after phase4_events.sql.
--
-- This places sample events around the Denver metro so they appear near a
-- map centered on Denver / 80125. It also removes the original Austin sample
-- events so the shopper list isn't cluttered with far-away listings.

-- Remove the Austin sample events seeded in phase4_events.sql (safe: scoped by name).
delete from public.events
where name in (
  'Downtown Makers Market',
  'Riverside Craft Fair',
  'Holiday Night Market',
  'Farmers & Flea Sunday',
  'Private Vendor Preview (Draft)'
);

insert into public.events
  (name, description, organizer_name, start_datetime, end_datetime,
   address, city, state, latitude, longitude, event_status, visibility_status,
   parking_info, admission_info)
values
  (
    'Sterling Ranch Farmers Market',
    'A neighborhood market in the 80125 area featuring local growers, bakers, and makers from southwest metro Denver.',
    'Sterling Ranch Community',
    now() + interval '3 days' + interval '9 hours',
    now() + interval '3 days' + interval '13 hours',
    '8170 Piney River Ave', 'Littleton', 'CO', 39.4860, -105.0137,
    'upcoming', 'public',
    'Free on-site lot parking.',
    'Free admission.'
  ),
  (
    'Roxborough Makers Pop-Up',
    'Handmade goods, candles, and art from artisans near Roxborough State Park.',
    'Roxborough Arts Collective',
    now() + interval '6 days' + interval '10 hours',
    now() + interval '6 days' + interval '15 hours',
    '6222 N Roxborough Park Rd', 'Littleton', 'CO', 39.4499, -105.0700,
    'upcoming', 'public',
    'Free parking; carpooling encouraged.',
    'Free for all ages.'
  ),
  (
    'Highlands Ranch Night Market',
    'An evening market with food trucks, live music, and local vendors at the Town Center.',
    'Highlands Ranch Events',
    now() + interval '9 days' + interval '17 hours',
    now() + interval '9 days' + interval '21 hours',
    '9288 Dorchester St', 'Highlands Ranch', 'CO', 39.5419, -104.9689,
    'upcoming', 'public',
    'Garage and street parking available.',
    '$5 entry, kids under 12 free.'
  ),
  (
    'Littleton Main Street Craft Fair',
    'Vintage finds, ceramics, and textiles along historic Littleton Main Street.',
    'Littleton Arts Guild',
    now() + interval '12 days' + interval '10 hours',
    now() + interval '12 days' + interval '16 hours',
    '2450 W Main St', 'Littleton', 'CO', 39.6133, -105.0166,
    'upcoming', 'public',
    'Free lot parking off Main St.',
    'Free admission.'
  ),
  (
    'Denver Union Station Market',
    'A bustling downtown market with regional farmers, roasters, and food makers outside Union Station.',
    'Denver Public Market Co.',
    now() + interval '5 days' + interval '8 hours',
    now() + interval '5 days' + interval '14 hours',
    '1701 Wynkoop St', 'Denver', 'CO', 39.7531, -104.9986,
    'upcoming', 'public',
    'Paid garage parking nearby; light rail accessible.',
    'Free admission.'
  ),
  (
    'South Pearl Street Sunday Market',
    'Fresh produce, baked goods, plants, and crafts in the Washington Park neighborhood.',
    'South Pearl Street Association',
    now() + interval '7 days' + interval '9 hours',
    now() + interval '7 days' + interval '13 hours',
    '1500 S Pearl St', 'Denver', 'CO', 39.6998, -104.9786,
    'upcoming', 'public',
    'Street parking only; arrive early.',
    'Free admission.'
  );
