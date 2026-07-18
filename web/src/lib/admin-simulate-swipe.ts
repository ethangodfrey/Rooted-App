import { api, isApiConfigured } from '@/lib/api';

export type SimulateSwipeResult = {
  ok: true;
  provider: string;
  metric_id: string;
  vendor_id: string;
  amount: number;
  source: 'SQUARE' | 'TOAST';
  stock_decrements: Array<{
    product_id: string;
    sku: string | null;
    quantity: number;
    stock_after: number;
  }>;
  message: string;
  confirmation: string;
  product_sku: string | null;
  product_name: string | null;
};

/** Admin-only: fire a mock POS swipe through /webhooks/pos analytics pipeline. */
export async function runSimulateSwipe(input?: {
  provider?: 'square' | 'toast';
  amount?: number;
  vendorId?: string;
}): Promise<SimulateSwipeResult> {
  if (!isApiConfigured) {
    throw new Error('Backend API is not configured for simulate-swipe.');
  }
  return api.post<SimulateSwipeResult>('/admin/simulate-swipe', input ?? {});
}
