/** Platform fulfillment fee in basis points (500 = 5%). */
export const DEFAULT_PLATFORM_FEE_BPS = 500;

export function resolvePlatformFeeBps(envValue: string | undefined): number {
  const parsed = Number.parseInt((envValue ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000) {
    return DEFAULT_PLATFORM_FEE_BPS;
  }
  return parsed;
}

/** Fee in integer cents using half-up rounding (matches Stripe amount fields). */
export function computePlatformFeeCents(
  subtotalCents: number,
  feeBps: number = DEFAULT_PLATFORM_FEE_BPS,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  if (!Number.isFinite(feeBps) || feeBps <= 0) return 0;
  return Math.round((subtotalCents * feeBps) / 10_000);
}
