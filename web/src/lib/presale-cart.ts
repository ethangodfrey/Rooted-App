import type { EventScheduleFields } from '@/lib/event-schedule';

/** Platform fulfillment fee — matches backend CheckoutService (500 bps = 5%). */
export const PLATFORM_FEE_BPS = 500;

/** Estimated state sales tax in basis points (for client-side display only). */
export const STATE_TAX_BPS: Record<string, number> = {
  AL: 400,
  AK: 0,
  AZ: 560,
  AR: 650,
  CA: 725,
  CO: 290,
  CT: 635,
  DC: 600,
  FL: 600,
  GA: 400,
  HI: 400,
  ID: 600,
  IL: 625,
  IN: 700,
  IA: 600,
  KS: 650,
  KY: 600,
  LA: 445,
  MA: 625,
  MD: 600,
  ME: 550,
  MI: 600,
  MN: 688,
  MO: 423,
  MS: 700,
  MT: 0,
  NC: 475,
  ND: 500,
  NE: 550,
  NH: 0,
  NJ: 663,
  NM: 512,
  NV: 685,
  NY: 800,
  OH: 575,
  OK: 450,
  OR: 0,
  PA: 600,
  RI: 700,
  SC: 600,
  SD: 450,
  TN: 700,
  TX: 625,
  UT: 610,
  VA: 530,
  VT: 600,
  WA: 650,
  WI: 500,
  WV: 600,
  WY: 400,
};

export interface PresaleCartLine {
  productId: string;
  vendorId: string;
  vendorName: string;
  name: string;
  /** Unit price in cents. */
  price: number;
  quantity: number;
  /** Max presale units allowed for this product at the active market. */
  maxQuantity: number;
  mediaUrl?: string | null;
  holdId?: string | null;
}

export interface PresaleCartMarket extends EventScheduleFields {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address?: string | null;
  start_datetime: string;
  end_datetime: string;
}

export interface PresaleCart {
  marketId: string;
  marketName: string;
  marketCity: string | null;
  marketState: string | null;
  marketAddress: string | null;
  pickupSchedule: Pick<PresaleCartMarket, 'start_datetime' | 'end_datetime' | 'timezone' | 'state' | 'hours_summary' | 'sync_metadata'>;
  lines: PresaleCartLine[];
  updatedAt: string;
}

export interface VendorCartGroup {
  vendorId: string;
  vendorName: string;
  lines: PresaleCartLine[];
  subtotal: number;
  estimatedTax: number;
  platformFee: number;
  total: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  estimatedTax: number;
  platformFee: number;
  grandTotal: number;
  vendorGroups: VendorCartGroup[];
}

const STORAGE_KEY = 'vendorly-presale-cart';

export function loadPresaleCart(): PresaleCart | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PresaleCart;
  } catch {
    return null;
  }
}

export function savePresaleCart(cart: PresaleCart): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...cart, updatedAt: new Date().toISOString() }),
  );
}

export function clearPresaleCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function cartItemCount(cart: PresaleCart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function groupCartByVendor(cart: PresaleCart): VendorCartGroup[] {
  const map = new Map<string, VendorCartGroup>();

  for (const line of cart.lines) {
    const current = map.get(line.vendorId);
    const lineSubtotal = line.price * line.quantity;
    if (current) {
      current.lines.push(line);
      current.subtotal += lineSubtotal;
    } else {
      map.set(line.vendorId, {
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        lines: [line],
        subtotal: lineSubtotal,
        estimatedTax: 0,
        platformFee: 0,
        total: 0,
      });
    }
  }

  const taxBps = estimateTaxBps(cart.marketState);
  return [...map.values()].map((group) => {
    const estimatedTax = Math.round((group.subtotal * taxBps) / 10_000);
    const platformFee = Math.round((group.subtotal * PLATFORM_FEE_BPS) / 10_000);
    return {
      ...group,
      estimatedTax,
      platformFee,
      total: group.subtotal + estimatedTax + platformFee,
    };
  });
}

export function computeCartTotals(cart: PresaleCart | null): CartTotals {
  if (!cart || cart.lines.length === 0) {
    return {
      itemCount: 0,
      subtotal: 0,
      estimatedTax: 0,
      platformFee: 0,
      grandTotal: 0,
      vendorGroups: [],
    };
  }

  const vendorGroups = groupCartByVendor(cart);
  const subtotal = vendorGroups.reduce((sum, group) => sum + group.subtotal, 0);
  const estimatedTax = vendorGroups.reduce((sum, group) => sum + group.estimatedTax, 0);
  const platformFee = vendorGroups.reduce((sum, group) => sum + group.platformFee, 0);

  return {
    itemCount: cartItemCount(cart),
    subtotal,
    estimatedTax,
    platformFee,
    grandTotal: subtotal + estimatedTax + platformFee,
    vendorGroups,
  };
}

export function estimateTaxBps(state: string | null | undefined): number {
  const key = (state ?? '').trim().toUpperCase().slice(0, 2);
  return STATE_TAX_BPS[key] ?? 0;
}

export function upsertPresaleLine(
  cart: PresaleCart,
  line: Omit<PresaleCartLine, 'quantity'> & { quantity?: number },
): PresaleCart {
  const quantity = Math.min(
    Math.max(1, line.quantity ?? 1),
    line.maxQuantity,
  );
  const idx = cart.lines.findIndex((l) => l.productId === line.productId);
  const nextLines = [...cart.lines];

  if (idx >= 0) {
    nextLines[idx] = {
      ...nextLines[idx],
      ...line,
      quantity,
      holdId: line.holdId ?? nextLines[idx].holdId,
    };
  } else {
    nextLines.push({ ...line, quantity });
  }

  return { ...cart, lines: nextLines, updatedAt: new Date().toISOString() };
}

export function updatePresaleLineQuantity(
  cart: PresaleCart,
  productId: string,
  quantity: number,
): PresaleCart {
  const nextLines = cart.lines
    .map((line) => {
      if (line.productId !== productId) return line;
      const nextQty = Math.min(Math.max(0, quantity), line.maxQuantity);
      return nextQty === 0 ? null : { ...line, quantity: nextQty };
    })
    .filter((line): line is PresaleCartLine => line != null);

  return { ...cart, lines: nextLines, updatedAt: new Date().toISOString() };
}

export function removePresaleLine(cart: PresaleCart, productId: string): PresaleCart {
  return {
    ...cart,
    lines: cart.lines.filter((line) => line.productId !== productId),
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyPresaleCart(market: PresaleCartMarket): PresaleCart {
  return {
    marketId: market.id,
    marketName: market.name,
    marketCity: market.city,
    marketState: market.state,
    marketAddress: market.address ?? null,
    pickupSchedule: {
      start_datetime: market.start_datetime,
      end_datetime: market.end_datetime,
      timezone: market.timezone,
      state: market.state,
      hours_summary: market.hours_summary,
      sync_metadata: market.sync_metadata,
    },
    lines: [],
    updatedAt: new Date().toISOString(),
  };
}
