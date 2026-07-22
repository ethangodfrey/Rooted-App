export const LOW_STOCK_WALK_UP_THRESHOLD = 5;
export const DEFAULT_FLASH_DISCOUNT_PERCENT = 15;

export interface FlashSaleState {
  active: boolean;
  productId: string;
  productName: string;
  unitsLeft: number;
  discountPercent: number;
  activatedAt: string;
}

export interface LowStockProduct {
  productId: string;
  productName: string;
  walkUpStock: number;
  eventId: string | null;
  eventName: string | null;
  flashActive: boolean;
}

export function flashSaleBadgeText(unitsLeft: number): string {
  const n = Math.max(0, Math.floor(unitsLeft));
  return `ONLY ${n} LEFT - FLASH SALE ACTIVE`;
}

export function parseFlashSale(raw: Record<string, unknown> | null | undefined): FlashSaleState | null {
  if (!raw || typeof raw !== 'object') return null;
  const flash = raw.flash_sale;
  if (!flash || typeof flash !== 'object') return null;
  const obj = flash as Record<string, unknown>;
  if (obj.active !== true) return null;
  if (typeof obj.productId !== 'string' || !obj.productId) return null;
  return {
    active: true,
    productId: obj.productId,
    productName: typeof obj.productName === 'string' ? obj.productName : 'Featured item',
    unitsLeft: Number.isFinite(Number(obj.unitsLeft)) ? Math.max(0, Math.floor(Number(obj.unitsLeft))) : 0,
    discountPercent: Number.isFinite(Number(obj.discountPercent))
      ? Math.min(90, Math.max(1, Math.round(Number(obj.discountPercent))))
      : DEFAULT_FLASH_DISCOUNT_PERCENT,
    activatedAt: typeof obj.activatedAt === 'string' ? obj.activatedAt : new Date().toISOString(),
  };
}

export function mergeFlashSaleIntoTheme(
  existing: Record<string, unknown> | null | undefined,
  flash: FlashSaleState,
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  return {
    ...base,
    featured_highlight: flashSaleBadgeText(flash.unitsLeft),
    flash_sale: {
      active: flash.active,
      productId: flash.productId,
      productName: flash.productName,
      unitsLeft: flash.unitsLeft,
      discountPercent: flash.discountPercent,
      activatedAt: flash.activatedAt,
    },
  };
}

export function isLowWalkUpStock(units: number, threshold = LOW_STOCK_WALK_UP_THRESHOLD): boolean {
  return Number.isFinite(units) && units >= 0 && units < threshold;
}
