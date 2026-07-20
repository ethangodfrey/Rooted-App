/**
 * Platform Admin Dashboard helpers.
 * Telemetry: ADMIN_DASHBOARD_ACTIVE, SYSTEM_TELEMETRY_INITIALIZED
 */

import type { FinancialTransactionStatus, FinancialTransactionType } from '../financial/financial.util';
import { normalizeFinancialStatus, normalizeFinancialType } from '../financial/financial.util';

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

export type AdminLedgerSortBy =
  | 'transaction_type'
  | 'status'
  | 'created_at'
  | 'amount_cents';

export function normalizeAdminLedgerSortBy(
  value: string | null | undefined,
): AdminLedgerSortBy {
  const lower = (value ?? '').trim().toLowerCase();
  if (lower === 'transaction_type' || lower === 'type') return 'transaction_type';
  if (lower === 'status') return 'status';
  if (lower === 'amount_cents' || lower === 'amount') return 'amount_cents';
  return 'created_at';
}

export function normalizeAdminSortDir(
  value: string | null | undefined,
): 'asc' | 'desc' {
  return (value ?? '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
}

export function parseAdminLedgerFilters(input: {
  status?: string;
  transactionType?: string;
}): {
  status: FinancialTransactionStatus | null;
  transactionType: FinancialTransactionType | null;
} {
  return {
    status: normalizeFinancialStatus(input.status),
    transactionType: normalizeFinancialType(input.transactionType),
  };
}

export function clampAdminPage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export function clampAdminPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return 20;
  return Math.min(100, Math.floor(pageSize));
}
