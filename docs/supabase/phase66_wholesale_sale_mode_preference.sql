-- Phase 66 — Dual-mode wholesale catalog preference.
-- Adds explicit sale_mode_preference enum for WHOLESALE_ONLY | RETAIL_ONLY | BOTH.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'wholesale_sale_mode_preference'
  ) THEN
    CREATE TYPE public.wholesale_sale_mode_preference AS ENUM (
      'WHOLESALE_ONLY',
      'RETAIL_ONLY',
      'BOTH'
    );
  END IF;
END $$;

ALTER TABLE public.wholesale_products
ADD COLUMN IF NOT EXISTS sale_mode_preference public.wholesale_sale_mode_preference
NOT NULL
DEFAULT 'WHOLESALE_ONLY';

-- Keep previous retail flag data aligned for existing catalogs.
UPDATE public.wholesale_products
SET sale_mode_preference = CASE
  WHEN is_retail_enabled IS TRUE THEN 'BOTH'::public.wholesale_sale_mode_preference
  ELSE 'WHOLESALE_ONLY'::public.wholesale_sale_mode_preference
END
WHERE sale_mode_preference IS NULL
   OR sale_mode_preference = 'WHOLESALE_ONLY'::public.wholesale_sale_mode_preference;
