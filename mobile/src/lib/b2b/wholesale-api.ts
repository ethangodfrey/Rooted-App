import { api } from '@/src/lib/api';

import type {
  WholesaleCatalogResponse,
  WholesaleOrderDraftPayload,
  WholesaleOrderDraftResponse,
} from './types';

/** GET /api/vendors/wholesale-products?vendorId= — peer catalog for buyer browse. */
export async function fetchWholesaleCatalog(
  sellerVendorId?: string | null,
): Promise<WholesaleCatalogResponse> {
  const params = new URLSearchParams();
  if (sellerVendorId?.trim()) params.set('vendorId', sellerVendorId.trim());
  const qs = params.size ? `?${params}` : '';
  return api.get<WholesaleCatalogResponse>(`/api/vendors/wholesale-products${qs}`);
}

/** POST /api/vendors/orders/drafts — same wire contract as tenant-web. */
export async function createWholesaleOrderDraft(
  payload: WholesaleOrderDraftPayload,
): Promise<WholesaleOrderDraftResponse> {
  return api.post<WholesaleOrderDraftResponse>('/api/vendors/orders/drafts', payload);
}
