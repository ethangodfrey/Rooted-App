-- Phase 67 — Vendor alerts for predictive analytics.
-- Adds vendor_alerts table with LOW_STOCK | PAYMENT_DELAY types.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'vendor_alert_type'
  ) THEN
    CREATE TYPE public.vendor_alert_type AS ENUM (
      'LOW_STOCK',
      'PAYMENT_DELAY'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  alert_type public.vendor_alert_type NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_alerts_vendor_type_created
  ON public.vendor_alerts (vendor_id, alert_type, created_at DESC);
