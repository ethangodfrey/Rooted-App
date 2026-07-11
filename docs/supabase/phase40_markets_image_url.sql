-- Phase 40 — static market hero URLs (Google Places / fallback CDN strings)
-- Run in Supabase SQL Editor after phase35_search_event_schedule.sql.
--
-- Vendorly stores farmer markets in public.events. The task shorthand "markets"
-- refers to those rows. image_url holds a persisted CDN URL so clients never
-- call Google Places during scroll.
--
-- If your project uses a dedicated public.markets table instead, run:
--   ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Keep legacy banner_url in sync for search_index matview (uses banner_url today).
UPDATE public.events
SET image_url = banner_url
WHERE image_url IS NULL
  AND banner_url IS NOT NULL;
