import { api } from '@/lib/api';

export type WholesaleListingItem = {
  id: string;
  producerId: string;
  producerType: string;
  producerName: string | null;
  itemName: string;
  itemCategory: string;
  bulkUnitPrice: number;
  minOrderQuantity: number;
  availabilityStatus: string;
  sellCity: string | null;
  sellState: string | null;
  postalCode: string | null;
  locationLabel: string | null;
};

export type ProcurementRequestItem = {
  id: string;
  farmerId?: string;
  farmName?: string | null;
  vendorId?: string;
  vendorName?: string | null;
  listingId: string | null;
  itemName?: string | null;
  message: string | null;
  requestedQuantity: number | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type DirectoryResponse = {
  STATUS: string;
  ITEMS: WholesaleListingItem[];
  COUNT: number;
};

export type ProcurementListResponse = {
  STATUS: string;
  ITEMS: ProcurementRequestItem[];
  COUNT: number;
};

export const PROCUREMENT_ITEM_CATEGORIES = [
  'ALL',
  'PRODUCE',
  'DAIRY',
  'MEAT',
  'EGGS',
  'BAKERY',
  'PANTRY',
  'GENERAL',
] as const;

export function formatProcurementStatusLabel(status: string): string {
  const upper = status.trim().toUpperCase();
  if (upper === 'DECLINED' || upper === 'REJECTED') return 'REJECTED';
  return upper || 'UNKNOWN';
}

export async function fetchWholesaleDirectory(input?: {
  q?: string;
  location?: string;
  category?: string;
  limit?: number;
}): Promise<DirectoryResponse> {
  const params = new URLSearchParams();
  if (input?.limit != null) params.set('limit', String(input.limit));
  if (input?.q?.trim()) params.set('q', input.q.trim());
  if (input?.location?.trim()) params.set('location', input.location.trim());
  if (input?.category?.trim() && input.category !== 'ALL') {
    params.set('category', input.category.trim());
  }
  const qs = params.toString();
  return api.get(`/api/b2b/directory${qs ? `?${qs}` : ''}`);
}

export async function fetchMyProcurementRequests(): Promise<ProcurementListResponse> {
  return api.get('/api/b2b/procurement');
}

export async function requestProcurementConnection(input: {
  farmerId: string;
  listingId?: string | null;
  message?: string | null;
  requestedQuantity?: number | null;
}): Promise<{
  STATUS: string;
  REQUEST_ID: string;
  REQUEST_STATUS: string;
}> {
  return api.post('/api/b2b/procurement', {
    farmerId: input.farmerId,
    listingId: input.listingId ?? null,
    message: input.message ?? null,
    requestedQuantity: input.requestedQuantity ?? null,
  });
}

export async function updateProcurementRequestStatus(
  requestId: string,
  status: string,
): Promise<{ STATUS: string; REQUEST_ID: string; REQUEST_STATUS: string }> {
  return api.patch(`/api/b2b/procurement/${requestId}`, { status });
}
