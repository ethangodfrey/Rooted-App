import { api } from '@/lib/api';

export type CateringServicePayload = {
  isCateringProvider: boolean;
  serviceDescription?: string;
  minGuests?: number;
  maxGuests?: number;
  priceRangeEstimate?: string | null;
};

export type CateringVendorResponse = {
  STATUS: string;
  VENDOR_ID: string;
  BUSINESS_NAME: string | null;
  IS_CATERING_PROVIDER: boolean;
  SERVICE: {
    serviceDescription: string;
    minGuests: number;
    maxGuests: number;
    priceRangeEstimate: string | null;
  } | null;
};

export type CateringProviderItem = {
  vendorId: string;
  businessName: string | null;
  isCateringProvider: boolean;
  serviceDescription: string | null;
  minGuests: number | null;
  maxGuests: number | null;
  priceRangeEstimate: string | null;
};

export async function fetchCateringForVendor(
  vendorId: string,
): Promise<CateringVendorResponse> {
  return api.get(`/api/catering/vendors/${vendorId}`);
}

export async function upsertCateringForVendor(
  vendorId: string,
  payload: CateringServicePayload,
): Promise<CateringVendorResponse> {
  return api.put(`/api/catering/vendors/${vendorId}`, payload);
}

export async function listCateringProviders(
  limit = 40,
): Promise<{ STATUS: string; COUNT: number; ITEMS: CateringProviderItem[] }> {
  return api.get(`/api/catering/providers?limit=${limit}`);
}

export async function submitCateringInquiry(input: {
  vendorId: string;
  message: string;
  guestCount?: number | null;
  eventDate?: string | null;
}): Promise<{
  STATUS: string;
  INQUIRY_ID: string;
  INQUIRY_STATUS?: string;
  CONFLICT_DETECTED?: boolean;
  CONFLICT_WARNING?: string | null;
}> {
  return api.post('/api/catering/inquiries', input);
}

export type CateringInquiryItem = {
  id: string;
  message: string;
  guestCount: number | null;
  eventDate: string | null;
  status: string;
  conflictDetected: boolean;
  conflictWarning: string | null;
  createdAt: string;
};

export async function fetchVendorCateringInquiries(
  vendorId: string,
): Promise<{ STATUS: string; ITEMS: CateringInquiryItem[]; COUNT: number }> {
  return api.get(`/api/catering/vendors/${vendorId}/inquiries`);
}
