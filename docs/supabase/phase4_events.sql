-- Rooted Phase 4: events (list + detail)
-- Run in Supabase SQL Editor after Phase 1.

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  organizer_name    text,
  banner_url        text,
  start_datetime    timestamptz not null,
  end_datetime      timestamptz not null,
  address           text,
  city              text,
  state             text,
  latitude          numeric not null,
  longitude         numeric not null,
  event_status      text not null default 'upcoming'
    check (event_status in ('upcoming', 'live', 'completed', 'cancelled')),
  visibility_status text not null default 'public'
    check (visibility_status in ('draft', 'public')),
  parking_info      text,
  admission_info    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.events enable row level security;

-- Any authenticated user can read public events.
create policy "Public read public events"
  on public.events for select
  using (visibility_status = 'public');

create index events_start_datetime_idx on public.events (start_datetime);
create index events_visibility_status_idx on public.events (visibility_status);

-- Seed data: 4 public upcoming events + 1 draft (should NOT appear in app).
insert into public.events
  (name, description, organizer_name, start_datetime, end_datetime,
   address, city, state, latitude, longitude, event_status, visibility_status,
   parking_info, admission_info)
values
  (
    'Downtown Makers Market',
    'A weekly open-air market featuring 40+ local makers, food trucks, and live music in the heart of downtown.',
    'Austin Maker Collective',
    now() + interval '3 days' + interval '9 hours',
    now() + interval '3 days' + interval '15 hours',
    '500 E Cesar Chavez St', 'Austin', 'TX', 30.2625, -97.7395,
    'upcoming', 'public',
    'Paid garage parking on Brazos St; street parking free on weekends.',
    'Free admission.'
  ),
  (
    'Riverside Craft Fair',
    'Handmade jewelry, ceramics, and textiles from regional artisans along the river walk.',
    'Riverside Arts Guild',
    now() + interval '8 days' + interval '10 hours',
    now() + interval '8 days' + interval '17 hours',
    '1200 Riverside Dr', 'Austin', 'TX', 30.2452, -97.7376,
    'upcoming', 'public',
    'Lot parking $5; bike valet available.',
    'Free for all ages.'
  ),
  (
    'Holiday Night Market',
    'An evening pop-up with seasonal goods, hot cocoa, and twinkling lights. Perfect for gift shopping.',
    'Eastside Events Co.',
    now() + interval '15 days' + interval '17 hours',
    now() + interval '15 days' + interval '22 hours',
    '979 Springdale Rd', 'Austin', 'TX', 30.2715, -97.7008,
    'upcoming', 'public',
    'Free lot parking on-site.',
    '$5 entry, kids under 12 free.'
  ),
  (
    'Farmers & Flea Sunday',
    'Fresh produce, baked goods, vintage finds, and plants every Sunday morning.',
    'South Congress Market',
    now() + interval '6 days' + interval '8 hours',
    now() + interval '6 days' + interval '13 hours',
    '1311 S Congress Ave', 'Austin', 'TX', 30.2489, -97.7501,
    'upcoming', 'public',
    'Street parking only; arrive early.',
    'Free admission.'
  ),
  (
    'Private Vendor Preview (Draft)',
    'Internal draft event used to verify that draft events stay hidden from shoppers.',
    'Rooted Team',
    now() + interval '20 days' + interval '9 hours',
    now() + interval '20 days' + interval '12 hours',
    '100 Congress Ave', 'Austin', 'TX', 30.2640, -97.7450,
    'upcoming', 'draft',
    null, null
  );
