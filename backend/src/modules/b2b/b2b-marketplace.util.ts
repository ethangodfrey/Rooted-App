/**
 * B2B peer marketplace helpers.
 * Telemetry: B2B_MARKETPLACE_INITIALIZED, WHOLESALE_DIRECTORY_ACTIVE
 */

export type WholesaleAvailabilityStatus =
  | 'AVAILABLE'
  | 'LIMITED'
  | 'UNAVAILABLE';

export type ProcurementRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED';

export function formatB2bMarketplaceInitializedLog(): string {
  return 'B2B_MARKETPLACE_INITIALIZED SURFACE=PEER_PROCUREMENT';
}

export function formatWholesaleDirectoryActiveLog(input?: {
  count?: number;
}): string {
  if (input?.count != null) {
    return `WHOLESALE_DIRECTORY_ACTIVE COUNT=${input.count}`;
  }
  return 'WHOLESALE_DIRECTORY_ACTIVE';
}

export function normalizeAvailabilityStatus(
  value: string | null | undefined,
): WholesaleAvailabilityStatus {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'LIMITED' || upper === 'UNAVAILABLE') return upper;
  return 'AVAILABLE';
}

export function normalizeProcurementStatus(
  value: string | null | undefined,
): ProcurementRequestStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (
    upper === 'PENDING' ||
    upper === 'ACCEPTED' ||
    upper === 'DECLINED' ||
    upper === 'CANCELLED'
  ) {
    return upper;
  }
  return null;
}

export function assertPositiveMoney(amount: number, label = 'PRICE'): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label}_INVALID`);
  }
}

export function assertMinOrderQuantity(qty: number): void {
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
    throw new Error('MIN_ORDER_QUANTITY_INVALID');
  }
}

export function formatProcurementRequestedLog(input: {
  vendorId: string;
  farmerId: string;
  listingId?: string | null;
}): string {
  const listing = input.listingId ? ` LISTING=${input.listingId}` : '';
  return `B2B_MARKETPLACE_INITIALIZED ACTION=PROCUREMENT_REQUESTED VENDOR=${input.vendorId} FARMER=${input.farmerId}${listing}`;
}
