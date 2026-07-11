import { computePlatformFeeCents, DEFAULT_PLATFORM_FEE_BPS } from './platform-fee';

export interface SettlementOrderInput {
  id: string;
  /** Gross order total in integer cents (subtotal charged to shopper). */
  totalCents: number;
  /** Persisted platform fee in cents; when omitted, derived from totalCents. */
  platformFeeCents?: number;
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

export interface SettlementCalculatorOptions {
  platformFeeBps?: number;
}

/**
 * Validates and aggregates post-market vendor settlements from completed orders.
 * Uses integer-cent math with standard half-up rounding to avoid float drift.
 */
export function calculateVendorSettlement(
  orders: SettlementOrderInput[],
  options: SettlementCalculatorOptions = {},
): SettlementAggregate {
  const feeBps = options.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;

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

  const grossVolumeCents = lines.reduce((sum, line) => sum + line.grossCents, 0);
  const platformFeeCents = lines.reduce((sum, line) => sum + line.platformFeeCents, 0);
  const netVendorCents = lines.reduce((sum, line) => sum + line.netVendorCents, 0);

  return {
    orderCount: lines.length,
    grossVolumeCents,
    platformFeeCents,
    netVendorCents,
    lines,
  };
}
