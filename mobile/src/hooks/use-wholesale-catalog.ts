import { useCallback, useEffect, useRef, useState } from 'react';

import type { WholesaleProductRow } from '@/src/lib/b2b/types';
import {
  readWholesaleCatalogCache,
  writeWholesaleCatalogCache,
} from '@/src/lib/b2b/wholesale-catalog-cache';
import { fetchWholesaleCatalog } from '@/src/lib/b2b/wholesale-api';
import { isDeviceOnline } from '@/src/workers/SyncWorker';

export type UseWholesaleCatalogOptions = {
  sellerVendorId?: string | null;
};

/**
 * Offline-first wholesale catalog: serve AsyncStorage cache when offline /
 * fetch fails, refresh from Nest when connectivity returns.
 */
export function useWholesaleCatalog(options: UseWholesaleCatalogOptions = {}) {
  const { sellerVendorId = null } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<WholesaleProductRow[]>([]);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [sessionVendorId, setSessionVendorId] = useState<string | null>(null);
  const [resolvedSellerId, setResolvedSellerId] = useState<string | null>(
    sellerVendorId?.trim() || null,
  );
  const [fromCache, setFromCache] = useState(false);
  const offlineSyncLogged = useRef(false);

  const applyCache = useCallback(
    (cached: Awaited<ReturnType<typeof readWholesaleCatalogCache>>) => {
      if (!cached) return false;
      setProducts(cached.products);
      setVendorName(cached.vendorName);
      setSessionVendorId(cached.sessionVendorId);
      setResolvedSellerId(cached.resolvedSellerId ?? cached.sellerVendorId);
      setFromCache(true);
      return true;
    },
    [],
  );

  const load = useCallback(async () => {
    const seller = sellerVendorId?.trim() || null;
    if (!seller) {
      setProducts([]);
      setVendorName(null);
      setError(null);
      setFromCache(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!offlineSyncLogged.current) {
      offlineSyncLogged.current = true;
      // eslint-disable-next-line no-console
      console.log('OFFLINE_SYNC_INITIALIZED');
    }

    const cached = await readWholesaleCatalogCache(seller);
    const online = await isDeviceOnline();

    if (!online) {
      if (applyCache(cached)) {
        // eslint-disable-next-line no-console
        console.log(
          `WHOLESALE_CATALOG_OFFLINE_HIT SELLER=${seller} COUNT=${cached!.count}`,
        );
        setError(null);
      } else {
        setProducts([]);
        setError('WHOLESALE_CATALOG_OFFLINE_MISS');
      }
      setLoading(false);
      return;
    }

    try {
      const body = await fetchWholesaleCatalog(seller);
      const nextProducts = Array.isArray(body.PRODUCTS) ? body.PRODUCTS : [];
      setProducts(nextProducts);
      setVendorName(body.VENDOR_NAME ?? null);
      setSessionVendorId(body.SESSION_VENDOR_ID ?? null);
      setResolvedSellerId(
        body.VIEW === 'PEER'
          ? body.VENDOR_ID ?? seller
          : body.VENDOR_ID ?? seller,
      );
      setFromCache(false);
      await writeWholesaleCatalogCache({ sellerVendorId: seller, response: body });
      // eslint-disable-next-line no-console
      console.log(
        `WHOLESALE_CATALOG_LOADED COUNT=${body.COUNT ?? nextProducts.length} CACHED=1`,
      );
    } catch (err) {
      if (applyCache(cached)) {
        // eslint-disable-next-line no-console
        console.log(
          `WHOLESALE_CATALOG_FALLBACK_CACHE SELLER=${seller} COUNT=${cached!.count}`,
        );
        setError('WHOLESALE_CATALOG_STALE_CACHE');
      } else {
        setProducts([]);
        setError(
          err instanceof Error
            ? err.message.toUpperCase()
            : 'WHOLESALE_CATALOG_LOAD_FAILED',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [applyCache, sellerVendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    products,
    vendorName,
    sessionVendorId,
    resolvedSellerId,
    fromCache,
    reload: load,
  };
}
