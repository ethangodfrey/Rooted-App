import { useEffect, useMemo, useState } from 'react';

import { useUserCoords } from '@/hooks/use-user-coords';
import { coordsFrom, distanceMiles, formatDistance, isValidCoords } from '@/lib/geo';
import type { MenuProduct } from '@/lib/product-menu';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';

export interface VendorUpcomingMarket {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  start_datetime: string;
  end_datetime: string;
  timezone: string | null;
  hours_summary: string | null;
  sync_metadata?: Record<string, unknown>;
  latitude: number;
  longitude: number;
  distanceLabel: string | null;
}

export interface UseVendorStorefrontResult {
  vendor: Vendor | null;
  products: MenuProduct[];
  upcomingMarkets: VendorUpcomingMarket[];
  distanceLabel: string | null;
  loading: boolean;
  error: string | null;
}

export function useVendorStorefront(vendorId: string | undefined): UseVendorStorefrontResult {
  const { coords } = useUserCoords();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [upcomingMarkets, setUpcomingMarkets] = useState<VendorUpcomingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [vendorRes, productsRes, marketsRes] = await Promise.all([
          supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
          supabase
            .from('products')
            .select(
              `id, name, description, price, category, reserve_enabled, media_urls,
             product_event_availability(available_quantity_presale)`,
            )
            .eq('vendor_id', vendorId)
            .eq('status', 'active')
            .order('name', { ascending: true }),
          supabase
            .from('vendor_events')
            .select(
              `event:events(
              id, name, city, state, address, start_datetime, end_datetime,
              timezone, hours_summary, sync_metadata, latitude, longitude
            )`,
            )
            .eq('vendor_id', vendorId)
            .eq('participation_status', 'approved'),
        ]);

        if (cancelled) return;

        if (vendorRes.error) {
          setError(vendorRes.error.message);
          setVendor(null);
          setProducts([]);
          setUpcomingMarkets([]);
          return;
        }

        if (!vendorRes.data) {
          setError('Vendor not found.');
          setVendor(null);
          setProducts([]);
          setUpcomingMarkets([]);
          return;
        }

        setVendor(vendorRes.data as Vendor);

        if (productsRes.error) {
          setError(productsRes.error.message);
          setProducts([]);
        } else {
          setProducts((productsRes.data as MenuProduct[] | null) ?? []);
        }

        if (marketsRes.error) {
          setError((current) => current ?? marketsRes.error!.message);
          setUpcomingMarkets([]);
        } else {
          const markets = ((marketsRes.data ?? []) as unknown as {
            event: Omit<VendorUpcomingMarket, 'distanceLabel'> | null;
          }[])
            .map((row) => row.event)
            .filter((event): event is Omit<VendorUpcomingMarket, 'distanceLabel'> => Boolean(event))
            .map((event) => ({
              ...event,
              distanceLabel: null as string | null,
            }));

          setUpcomingMarkets(markets);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load vendor');
        setVendor(null);
        setProducts([]);
        setUpcomingMarkets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const vendorDistanceLabel = useMemo(() => {
    if (!vendor || !isValidCoords(coords)) return null;
    const vendorCoords = coordsFrom({ latitude: vendor.latitude, longitude: vendor.longitude });
    if (!vendorCoords) return null;
    return formatDistance(distanceMiles(coords, vendorCoords));
  }, [coords, vendor]);

  const upcomingMarketsWithDistance = useMemo(() => {
    if (!isValidCoords(coords)) return upcomingMarkets;
    return upcomingMarkets.map((market) => {
      const marketCoords = coordsFrom({ latitude: market.latitude, longitude: market.longitude });
      if (!marketCoords) return market;
      return {
        ...market,
        distanceLabel: formatDistance(distanceMiles(coords, marketCoords)),
      };
    });
  }, [coords, upcomingMarkets]);

  return {
    vendor,
    products,
    upcomingMarkets: upcomingMarketsWithDistance,
    distanceLabel: vendorDistanceLabel,
    loading,
    error,
  };
}
