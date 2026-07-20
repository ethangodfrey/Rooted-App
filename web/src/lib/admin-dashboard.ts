import { api } from '@/lib/api';

/**
 * Phase 7 Platform Admin Dashboard client.
 * Telemetry: ADMIN_DASHBOARD_ACTIVE, SYSTEM_TELEMETRY_INITIALIZED
 */

export type AdminTelemetry = {
  STATUS: string;
  TOTAL_GMV_CENTS: number;
  ACTIVE_ESCROW_CENTS: number;
  PLATFORM_REVENUE_CENTS: number;
  PLATFORM_FEE_BPS: number;
  SETTLED_COUNT: number;
  ESCROW_COUNT: number;
};

export type AdminFleetRoute = {
  id: string;
  farmerId: string;
  farmName: string | null;
  dispatchDate: string;
  status: string;
  pendingStops: number;
  deliveredStops: number;
  totalStops: number;
  createdAt: string;
};

export type AdminLogisticsResponse = {
  STATUS: string;
  COUNT: number;
  ITEMS: AdminFleetRoute[];
};

export type AdminLedgerItem = {
  id: string;
  sourceId: string | null;
  destinationId: string | null;
  amountCents: number;
  voucherCents: number;
  netAmountCents: number;
  status: string;
  transactionType: string;
  referenceId: string | null;
  createdAt: string;
};

export type AdminLedgerResponse = {
  STATUS: string;
  PAGE: number;
  PAGE_SIZE: number;
  TOTAL: number;
  TOTAL_PAGES: number;
  SORT_BY: string;
  SORT_DIR: string;
  FILTER_STATUS: string | null;
  FILTER_TYPE: string | null;
  ITEMS: AdminLedgerItem[];
};

export type AdminLedgerQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  transactionType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export function formatAdminDashboardActiveLog(input?: {
  gmvCents?: number;
  escrowCents?: number;
}): string {
  const parts = ['ADMIN_DASHBOARD_ACTIVE'];
  if (input?.gmvCents != null) parts.push(`GMV_CENTS=${input.gmvCents}`);
  if (input?.escrowCents != null) parts.push(`ESCROW_CENTS=${input.escrowCents}`);
  return parts.join(' ');
}

export function formatSystemTelemetryInitializedLog(): string {
  return 'SYSTEM_TELEMETRY_INITIALIZED SERVICE=AdminDashboardService';
}

export async function fetchAdminTelemetry(): Promise<AdminTelemetry> {
  return api.get('/api/admin/telemetry');
}

export async function fetchAdminLogistics(
  limit = 50,
): Promise<AdminLogisticsResponse> {
  return api.get(`/api/admin/logistics?limit=${limit}`);
}

export async function fetchAdminLedger(
  query: AdminLedgerQuery = {},
): Promise<AdminLedgerResponse> {
  const params = new URLSearchParams();
  if (query.page != null) params.set('page', String(query.page));
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.transactionType) {
    params.set('transactionType', query.transactionType);
  }
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDir) params.set('sortDir', query.sortDir);
  const qs = params.toString();
  return api.get(`/api/admin/ledger${qs ? `?${qs}` : ''}`);
}
