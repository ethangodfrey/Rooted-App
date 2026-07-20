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

/** Normalize status; REJECTED is accepted as an alias for DECLINED. */
export function normalizeProcurementStatus(
  value: string | null | undefined,
): ProcurementRequestStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'REJECTED') return 'DECLINED';
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

/** Vendor Procurement Dashboard telemetry (no emoji). */
export function formatProcurementDashboardInitializedLog(): string {
  return 'PROCUREMENT_DASHBOARD_INITIALIZED SURFACE=VENDOR_B2B';
}

export function formatWholesaleUiActiveLog(input?: { count?: number }): string {
  if (input?.count != null) {
    return `WHOLESALE_UI_ACTIVE COUNT=${input.count}`;
  }
  return 'WHOLESALE_UI_ACTIVE';
}

export function formatProcurementStatusUpdatedLog(input: {
  requestId: string;
  status: ProcurementRequestStatus;
}): string {
  return `PROCUREMENT_DASHBOARD_INITIALIZED ACTION=STATUS_UPDATED REQUEST=${input.requestId} STATUS=${input.status}`;
}

/** Derive a coarse item category for directory filters when no DB column is set. */
export function inferItemCategory(itemName: string | null | undefined): string {
  const n = (itemName ?? '').trim().toLowerCase();
  if (!n) return 'GENERAL';
  if (/\b(dairy|milk|cheese|yogurt|butter|cream)\b/.test(n)) return 'DAIRY';
  if (/\b(meat|beef|pork|chicken|poultry|lamb|sausage)\b/.test(n)) return 'MEAT';
  if (/\b(eggs?)\b/.test(n)) return 'EGGS';
  if (/\b(bread|bakery|pastry|flour)\b/.test(n)) return 'BAKERY';
  if (/\b(honey|jam|preserve|syrup)\b/.test(n)) return 'PANTRY';
  if (
    /\b(fruit|berr(?:y|ies)|apples?|citrus|produce|vegetables?|veggies?|lettuce|tomatoes?|herbs?|greens)\b/.test(
      n,
    )
  ) {
    return 'PRODUCE';
  }
  return 'GENERAL';
}

export const WHOLESALE_ITEM_CATEGORIES = [
  'PRODUCE',
  'DAIRY',
  'MEAT',
  'EGGS',
  'BAKERY',
  'PANTRY',
  'GENERAL',
] as const;
