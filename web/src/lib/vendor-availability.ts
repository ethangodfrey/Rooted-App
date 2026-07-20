import { api } from '@/lib/api';

export type AvailabilityStatus = 'AVAILABLE' | 'BLOCKED';

export type AvailabilityBlock = {
  id: string;
  blockedDate: string;
  reason: string;
};

export type AvailabilityCheckResponse = {
  STATUS: AvailabilityStatus;
  VENDOR_ID: string;
  DATE: string;
  BLOCKED: boolean;
  REASONS: string[];
  CONFLICT_WARNING: string | null;
};

export type AvailabilityBlocksResponse = {
  STATUS: string;
  VENDOR_ID: string;
  ITEMS: AvailabilityBlock[];
  COUNT: number;
};

export async function checkVendorAvailability(
  vendorId: string,
  date: string,
): Promise<AvailabilityCheckResponse> {
  const qs = new URLSearchParams({ date });
  return api.get(`/api/availability/vendors/${vendorId}/check?${qs}`);
}

export async function fetchVendorAvailabilityBlocks(
  vendorId: string,
  from?: string,
  to?: string,
): Promise<AvailabilityBlocksResponse> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return api.get(
    `/api/availability/vendors/${vendorId}/blocks${qs ? `?${qs}` : ''}`,
  );
}

export async function setVendorAvailabilityBlock(input: {
  vendorId: string;
  date: string;
  reason: 'CATERING' | 'MARKET';
  blocked: boolean;
}): Promise<AvailabilityCheckResponse> {
  return api.put(`/api/availability/vendors/${input.vendorId}/blocks`, {
    date: input.date,
    reason: input.reason,
    blocked: input.blocked,
  });
}
