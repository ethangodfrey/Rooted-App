import { api } from '@/lib/api';

export type ChefProcurementCatalogItem = {
  id: string;
  vendorId: string;
  vendorName: string | null;
  name: string;
  description: string | null;
  category: string | null;
  retailPriceCents: number;
  wholesalePriceCents: number;
  moqQuantity: number;
  mediaUrls: string[];
  locationLabel: string | null;
};

export type ChefProcurementCartLine = {
  productId: string;
  quantity: number;
};

export async function fetchChefProcurementCatalog(input?: {
  q?: string;
  limit?: number;
}): Promise<{
  STATUS: string;
  ITEMS: ChefProcurementCatalogItem[];
  COUNT: number;
}> {
  const params = new URLSearchParams();
  if (input?.q?.trim()) params.set('q', input.q.trim());
  if (input?.limit != null) params.set('limit', String(input.limit));
  const qs = params.toString();
  return api.get(`/api/b2b/chef-procurement/catalog${qs ? `?${qs}` : ''}`);
}

export async function checkoutChefProcurement(input: {
  lines: ChefProcurementCartLine[];
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{
  STATUS: string;
  ORDER_ID: string;
  PICKUP_CODE: string;
  SUBTOTAL_CENTS: number;
  CHECKOUT_URL: string;
  SESSION_ID: string;
}> {
  return api.post('/api/b2b/chef-procurement/checkout', input);
}

export async function confirmChefProcurementPickup(input: {
  orderId: string;
  pickupCode: string;
}): Promise<{ STATUS: string; ACTION: string; ORDER_ID: string }> {
  return api.post(`/api/b2b/chef-procurement/${input.orderId}/confirm-pickup`, {
    pickupCode: input.pickupCode,
  });
}

export async function listChefProcurementOrders(): Promise<{
  STATUS: string;
  ITEMS: Array<{
    id: string;
    status: string;
    subtotalCents: number;
    pickupCode: string;
    sellerVendorId: string;
    items: Array<{
      productName: string;
      quantity: number;
      moqQuantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }>;
  }>;
  COUNT: number;
}> {
  return api.get('/api/b2b/chef-procurement/orders');
}
