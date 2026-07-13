import { useEffect, useMemo, useState } from 'react';

import { useUserCoords } from '@/hooks/use-user-coords';
import { coordsFrom, distanceMiles, formatDistance, isValidCoords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';

export interface MarketAttendingVendor {
  id: string;
  business_name: string | null;
  category: string | null;
  logo_url: string | null;
  product_summary: string | null;
  sell_city: string | null;
  sell_state: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UseMarketDetailResult {
  event: Event | null;
  vendors: MarketAttendingVendor[];
  distanceLabel: string | null;
  loading: boolean;
  error: string | null;
}

export function useMarketDetail(marketId: string | undefined): UseMarketDetailResult {
  const { coords } = useUserCoords();
  const [event, setEvent] = useState<Event | null>(null);
  const [vendors, setVendors] = useState<MarketAttendingVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [eventRes, vendorEventsRes] = await Promise.all([
          supabase.from('events').select('*').eq('id', marketId).maybeSingle(),
          supabase
            .from('vendor_events')
            .select(
              `vendor:vendors(
              id,
              business_name,
              category,
              logo_url,
              product_summary,
              sell_city,
              sell_state,
              latitude,
              longitude,
              approval_status
            )`,
            )
            .eq('event_id', marketId)
            .eq('participation_status', 'approved'),
        ]);

        if (cancelled) return;

        if (eventRes.error) {
          setError(eventRes.error.message);
          setEvent(null);
          setVendors([]);
          return;
        }

        setEvent((eventRes.data as Event | null) ?? null);

        if (vendorEventsRes.error) {
          setVendors([]);
          return;
        }

        const vendorList = ((vendorEventsRes.data ?? []) as unknown as {
          vendor: (MarketAttendingVendor & { approval_status?: string }) | null;
        }[])
          .map((row) => row.vendor)
          .filter((vendor): vendor is MarketAttendingVendor & { approval_status?: string } => Boolean(vendor))
          .filter((vendor) => vendor.approval_status === 'approved')
          .map(({ approval_status: _omit, ...vendor }) => vendor);

        setVendors(vendorList);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load market');
        setEvent(null);
        setVendors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [marketId]);

  const distanceLabel = useMemo(() => {
    if (!event || !isValidCoords(coords)) return null;
    const marketCoords = coordsFrom({ latitude: event.latitude, longitude: event.longitude });
    if (!marketCoords) return null;
    return formatDistance(distanceMiles(coords, marketCoords));
  }, [coords, event]);

  return { event, vendors, distanceLabel, loading, error };
}
