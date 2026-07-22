/**
 * Phase 83f — flash promotional campaign helpers.
 * Stored under vendors.theme_settings.flash_sale (JSON).
 */

export const LOW_STOCK_WALK_UP_THRESHOLD = 5;
export const DEFAULT_FLASH_DISCOUNT_PERCENT = 15;
export const MAX_FLASH_DISCOUNT_PERCENT = 90;
export const MIN_FLASH_DISCOUNT_PERCENT = 1;

export interface FlashPromoCampaign {
  active: boolean;
  productId: string;
  productName: string;
  unitsLeft: number;
  discountPercent: number;
  activatedAt: string;
  expiresAt: string | null;
}

export interface CreateFlashPromoInput {
  productId: string;
  productName?: string;
  unitsLeft: number;
  discountPercent?: number;
  expiresAt?: string | null;
  activatedAt?: string;
}

export function flashPromoBadgeText(unitsLeft: number): string {
  const n = Math.max(0, Math.floor(unitsLeft));
  return `ONLY ${n} LEFT - FLASH SALE ACTIVE`;
}

export function clampDiscountPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FLASH_DISCOUNT_PERCENT;
  return Math.min(
    MAX_FLASH_DISCOUNT_PERCENT,
    Math.max(MIN_FLASH_DISCOUNT_PERCENT, Math.round(value as number)),
  );
}

export function createFlashPromoCampaign(
  input: CreateFlashPromoInput,
): FlashPromoCampaign {
  if (!input.productId?.trim()) {
    throw new Error('FLASH_PROMO_INVALID: PRODUCT_ID_REQUIRED');
  }
  if (!Number.isFinite(input.unitsLeft) || input.unitsLeft < 0) {
    throw new Error('FLASH_PROMO_INVALID: UNITS_LEFT_INVALID');
  }
  if (input.expiresAt) {
    const expires = Date.parse(input.expiresAt);
    if (!Number.isFinite(expires)) {
      throw new Error('FLASH_PROMO_INVALID: EXPIRES_AT_INVALID');
    }
  }

  return {
    active: true,
    productId: input.productId.trim(),
    productName: input.productName?.trim() || 'Featured item',
    unitsLeft: Math.max(0, Math.floor(input.unitsLeft)),
    discountPercent: clampDiscountPercent(input.discountPercent),
    activatedAt: input.activatedAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };
}

export function parseFlashPromoCampaign(
  themeSettings: unknown,
): FlashPromoCampaign | null {
  if (!themeSettings || typeof themeSettings !== 'object') return null;
  const flash = (themeSettings as Record<string, unknown>).flash_sale;
  if (!flash || typeof flash !== 'object') return null;
  const obj = flash as Record<string, unknown>;
  if (obj.active !== true) return null;
  if (typeof obj.productId !== 'string' || !obj.productId) return null;

  const expiresAt =
    typeof obj.expiresAt === 'string' && obj.expiresAt ? obj.expiresAt : null;
  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) {
      return null;
    }
  }

  return {
    active: true,
    productId: obj.productId,
    productName:
      typeof obj.productName === 'string' ? obj.productName : 'Featured item',
    unitsLeft: Number.isFinite(Number(obj.unitsLeft))
      ? Math.max(0, Math.floor(Number(obj.unitsLeft)))
      : 0,
    discountPercent: clampDiscountPercent(
      Number.isFinite(Number(obj.discountPercent))
        ? Number(obj.discountPercent)
        : undefined,
    ),
    activatedAt:
      typeof obj.activatedAt === 'string'
        ? obj.activatedAt
        : new Date().toISOString(),
    expiresAt,
  };
}

export function mergeFlashPromoIntoTheme(
  existing: unknown,
  campaign: FlashPromoCampaign,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object'
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    featured_highlight: flashPromoBadgeText(campaign.unitsLeft),
    flash_sale: {
      active: campaign.active,
      productId: campaign.productId,
      productName: campaign.productName,
      unitsLeft: campaign.unitsLeft,
      discountPercent: campaign.discountPercent,
      activatedAt: campaign.activatedAt,
      expiresAt: campaign.expiresAt,
    },
  };
}

export function clearFlashPromoFromTheme(
  existing: unknown,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object'
      ? { ...(existing as Record<string, unknown>) }
      : {};
  delete base.flash_sale;
  delete base.featured_highlight;
  return base;
}

export function applyFlashDiscount(
  priceCents: number,
  discountPercent: number,
): number {
  const price = Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;
  const pct = clampDiscountPercent(discountPercent);
  return Math.max(0, Math.round(price * (1 - pct / 100)));
}

export function isLowWalkUpStock(
  units: number,
  threshold = LOW_STOCK_WALK_UP_THRESHOLD,
): boolean {
  return Number.isFinite(units) && units >= 0 && units < threshold;
}

export function validateFlashPromoCampaign(
  campaign: FlashPromoCampaign,
): { ok: true } | { ok: false; reason: string } {
  if (!campaign.active) return { ok: false, reason: 'INACTIVE' };
  if (!campaign.productId) return { ok: false, reason: 'PRODUCT_ID_REQUIRED' };
  if (campaign.unitsLeft < 0) return { ok: false, reason: 'UNITS_LEFT_INVALID' };
  if (
    campaign.discountPercent < MIN_FLASH_DISCOUNT_PERCENT ||
    campaign.discountPercent > MAX_FLASH_DISCOUNT_PERCENT
  ) {
    return { ok: false, reason: 'DISCOUNT_OUT_OF_RANGE' };
  }
  if (campaign.expiresAt) {
    const expiresMs = Date.parse(campaign.expiresAt);
    if (!Number.isFinite(expiresMs)) return { ok: false, reason: 'EXPIRES_AT_INVALID' };
    if (expiresMs < Date.now()) return { ok: false, reason: 'EXPIRED' };
  }
  return { ok: true };
}
