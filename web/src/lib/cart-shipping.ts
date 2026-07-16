/** Vendor shipping settings used at checkout (Phase 50 micro brands). */

export interface VendorShippingSettings {
  vendorId: string;
  shippingEnabled: boolean;
  flatRateShippingFeeCents: number;
  freeShippingMinimumCents: number | null;
}

/** Flat fee per shipping-enabled vendor, waived when that vendor's subtotal meets free threshold. */
export function computeShippingFeeCents(
  settings: VendorShippingSettings[],
  vendorSubtotals: Map<string, number>,
): number {
  let total = 0;
  for (const vendor of settings) {
    if (!vendor.shippingEnabled) continue;
    const subtotal = vendorSubtotals.get(vendor.vendorId) ?? 0;
    const freeMin = vendor.freeShippingMinimumCents;
    if (freeMin != null && freeMin > 0 && subtotal >= freeMin) continue;
    total += Math.max(0, vendor.flatRateShippingFeeCents);
  }
  return total;
}

export function formatShippingAddressBlock(address: {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
}): string {
  const lines = [
    address.name.trim(),
    address.line1.trim(),
    address.line2?.trim(),
    `${address.city.trim()}, ${address.state.trim().toUpperCase()} ${address.postalCode.trim()}`,
  ].filter(Boolean);
  return `Ship to:\n${lines.join('\n')}`;
}
