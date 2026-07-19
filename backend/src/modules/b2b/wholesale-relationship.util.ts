export type WholesalePricingMode = 'TIERED_WHOLESALE_PRICING' | 'STANDARD';

export type PeerRelationshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null;

/**
 * Resolve wholesale pricing mode from peer connection status.
 * ACCEPTED → TIERED_WHOLESALE_PRICING; otherwise STANDARD.
 */
export function resolveWholesalePricingMode(
  status: PeerRelationshipStatus,
): WholesalePricingMode {
  return status === 'ACCEPTED' ? 'TIERED_WHOLESALE_PRICING' : 'STANDARD';
}

export function isPeerRelationshipBlocked(
  status: PeerRelationshipStatus,
): boolean {
  return status === 'BLOCKED';
}
