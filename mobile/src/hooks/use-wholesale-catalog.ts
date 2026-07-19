import { useCallback, useEffect, useState } from 'react';

import type { WholesaleProductRow } from '@/src/lib/b2b/types';
import { fetchWholesaleCatalog } from '@/src/lib/b2b/wholesale-api';

export type UseWholesaleCatalogOptions = {
  sellerVendorId?: string | null;
};

/**
 * Online catalog loader for Phase 9a. Offline-first caching lands in Phase 9b.
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
      // eslint-disable-next-line no-console
      console.log(`WHOLESALE_CATALOG_LOADED COUNT=${body.COUNT ?? nextProducts.length}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'WHOLESALE_CATALOG_LOAD_FAILED',
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [sellerVendorId]);

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
