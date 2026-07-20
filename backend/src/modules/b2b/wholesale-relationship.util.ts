export type WholesalePricingMode =
  | 'TIERED_WHOLESALE_PRICING'
  | 'STANDARD'
  | 'RETAIL_SALE';

export type PeerRelationshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null;

/**
 * Resolve wholesale pricing mode from peer connection status.
 * ACCEPTED → TIERED_WHOLESALE_PRICING; otherwise STANDARD.
 * Retail sale mode is selected separately via sale_mode=RETAIL.
 */
export function resolveWholesalePricingMode(
  status: PeerRelationshipStatus,
): Exclude<WholesalePricingMode, 'RETAIL_SALE'> {
  return status === 'ACCEPTED' ? 'TIERED_WHOLESALE_PRICING' : 'STANDARD';
}

export function isPeerRelationshipBlocked(
  status: PeerRelationshipStatus,
): boolean {
  return status === 'BLOCKED';
}

/** Convert retail USD decimal to integer cents for order line snapshots. */
export function retailPriceToCents(retailPrice: unknown): number | null {
  if (retailPrice == null) return null;
  const value =
    typeof retailPrice === 'number'
      ? retailPrice
      : typeof retailPrice === 'object' &&
          retailPrice !== null &&
          'toNumber' in retailPrice &&
          typeof (retailPrice as { toNumber: () => number }).toNumber ===
            'function'
        ? (retailPrice as { toNumber: () => number }).toNumber()
        : Number(retailPrice);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
