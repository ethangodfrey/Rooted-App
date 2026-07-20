import { api } from '@/lib/api';
import {
  fetchMyProcurementRequests,
  type ProcurementRequestItem,
} from '@/lib/b2b-procurement';

export type DeliveryStopItem = {
  id: string;
  procurementRequestId: string;
  vendorId: string;
  dropoffOrder: number;
  status: string;
};

export type DeliveryRouteItem = {
  id: string;
  dispatchDate: string;
  status: string;
  createdAt: string;
  stops: DeliveryStopItem[];
};

export type LogisticsRoutesResponse = {
  STATUS: string;
  ITEMS: DeliveryRouteItem[];
  COUNT: number;
};

export type CreateRouteResponse = {
  STATUS: string;
  ACTION: string;
  ROUTE_ID: string;
  FARMER_ID: string;
  DISPATCH_DATE: string;
  ROUTE_STATUS: string;
  STOPS: Array<{
    id: string;
    procurementRequestId: string;
    vendorId: string;
    dropoffOrder: number;
    status: string;
  }>;
  COUNT: number;
};

export type ConfirmDropoffResponse = {
  STATUS: string;
  ACTION: string;
  STOP_ID: string;
  ROUTE_ID: string;
  PROCUREMENT_REQUEST_ID: string;
  VENDOR_ID: string;
  FARMER_ID: string;
  STOP_STATUS: string;
  ROUTE_STATUS: string;
  SETTLEMENT?: {
    STATUS?: string;
    ACTION?: string;
    NET_AMOUNT_CENTS?: number;
    TRANSACTION_ID?: string;
  };
};

export async function fetchAcceptedProcurementForDispatch(): Promise<
  ProcurementRequestItem[]
> {
  const res = await fetchMyProcurementRequests();
  return (res.ITEMS ?? []).filter(
    (row) => row.status.trim().toUpperCase() === 'ACCEPTED',
  );
}

export async function fetchMyDeliveryRoutes(
  limit = 20,
): Promise<LogisticsRoutesResponse> {
  return api.get(`/api/logistics/routes?limit=${limit}`);
}

export async function createDeliveryRoute(input: {
  procurementRequestIds: string[];
  dispatchDate?: string;
}): Promise<CreateRouteResponse> {
  return api.post('/api/logistics/routes', {
    procurementRequestIds: input.procurementRequestIds,
    dispatchDate: input.dispatchDate,
  });
}

export async function confirmDeliveryDropoff(
  stopId: string,
): Promise<ConfirmDropoffResponse> {
  return api.post(`/api/logistics/stops/${stopId}/confirm`);
}

export function formatUsdFromCents(cents: number | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '$0.00';
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}
