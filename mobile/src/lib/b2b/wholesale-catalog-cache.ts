import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WholesaleCatalogResponse, WholesaleProductRow } from './types';

const STORAGE_PREFIX = 'vendorly.wholesale.catalog.v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export type CachedWholesaleCatalog = {
  sellerVendorId: string;
  cachedAt: number;
  vendorName: string | null;
  sessionVendorId: string | null;
  resolvedSellerId: string | null;
  products: WholesaleProductRow[];
  count: number;
};

function cacheKey(sellerVendorId: string): string {
  return `${STORAGE_PREFIX}:${sellerVendorId.trim().toLowerCase()}`;
}

export async function readWholesaleCatalogCache(
  sellerVendorId: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<CachedWholesaleCatalog | null> {
  const seller = sellerVendorId.trim();
  if (!seller) return null;

  try {
    const raw = await AsyncStorage.getItem(cacheKey(seller));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWholesaleCatalog;
    if (!parsed || !Array.isArray(parsed.products)) return null;
    if (typeof parsed.cachedAt !== 'number') return null;
    if (Date.now() - parsed.cachedAt > ttlMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWholesaleCatalogCache(input: {
  sellerVendorId: string;
  response: WholesaleCatalogResponse;
}): Promise<CachedWholesaleCatalog | null> {
  const seller = input.sellerVendorId.trim();
  if (!seller) return null;

  const products = Array.isArray(input.response.PRODUCTS)
    ? input.response.PRODUCTS
    : [];
  const resolvedSellerId =
    input.response.VIEW === 'PEER'
      ? input.response.VENDOR_ID ?? seller
      : input.response.VENDOR_ID ?? seller;

  const entry: CachedWholesaleCatalog = {
    sellerVendorId: seller,
    cachedAt: Date.now(),
    vendorName: input.response.VENDOR_NAME ?? null,
    sessionVendorId: input.response.SESSION_VENDOR_ID ?? null,
    resolvedSellerId,
    products,
    count: input.response.COUNT ?? products.length,
  };

  try {
    await AsyncStorage.setItem(cacheKey(seller), JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}

export async function clearWholesaleCatalogCache(
  sellerVendorId: string,
): Promise<void> {
  const seller = sellerVendorId.trim();
  if (!seller) return;
  try {
    await AsyncStorage.removeItem(cacheKey(seller));
  } catch {
    // ignore storage failures
  }
}
