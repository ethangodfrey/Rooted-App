/** Platform fulfillment fee in basis points (500 = 5%). Matches backend CheckoutService. */
export const PLATFORM_FEE_BPS = 500;

export interface SettlementOrderInput {
  id: string;
  /** Gross order total in integer cents. */
  totalCents: number;
  /** Persisted platform fee in cents; derived from total when omitted. */
  platformFeeCents?: number;
  /** Fulfillment/completion timestamp for chronological chart grouping. */
  completedAt?: string;
}

export interface SettlementLineItem {
  orderId: string;
  grossCents: number;
  platformFeeCents: number;
  netVendorCents: number;
}

export interface SettlementAggregate {
  orderCount: number;
  grossVolumeCents: number;
  platformFeeCents: number;
  netVendorCents: number;
  lines: SettlementLineItem[];
}

/** Fee in integer cents with half-up rounding (no floating-point drift). */
export function computePlatformFeeCents(
  subtotalCents: number,
  feeBps: number = PLATFORM_FEE_BPS,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  if (!Number.isFinite(feeBps) || feeBps <= 0) return 0;
  return Math.round((subtotalCents * feeBps) / 10_000);
}

/**
 * Aggregates post-market vendor settlement totals from completed orders.
 * Separates gross volume, 5% platform fulfillment fee, and net vendor allocation.
 */
export function calculateVendorSettlement(
  orders: SettlementOrderInput[],
  feeBps: number = PLATFORM_FEE_BPS,
): SettlementAggregate {
  const lines: SettlementLineItem[] = orders.map((order) => {
    const grossCents = Math.max(0, Math.round(order.totalCents));
    const platformFeeCents =
      order.platformFeeCents != null && Number.isFinite(order.platformFeeCents)
        ? Math.max(0, Math.round(order.platformFeeCents))
        : computePlatformFeeCents(grossCents, feeBps);
    const netVendorCents = Math.max(0, grossCents - platformFeeCents);

    return {
      orderId: order.id,
      grossCents,
      platformFeeCents,
      netVendorCents,
    };
  });

  return {
    orderCount: lines.length,
    grossVolumeCents: lines.reduce((sum, line) => sum + line.grossCents, 0),
    platformFeeCents: lines.reduce((sum, line) => sum + line.platformFeeCents, 0),
    netVendorCents: lines.reduce((sum, line) => sum + line.netVendorCents, 0),
    lines,
  };
}
