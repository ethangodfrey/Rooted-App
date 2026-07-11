import type { Vendor } from '@/types/database';

export const PAYMENT_METHOD_OPTIONS = [
  'Cash',
  'Card',
  'Venmo',
  'Apple Pay',
  'SNAP / EBT',
  'Contactless',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number];

export const STOREFRONT_ACCENT_OPTIONS = [
  { id: 'forest', label: 'Forest', color: '#228B22' },
  { id: 'emerald', label: 'Emerald', color: '#50C878' },
  { id: 'sage', label: 'Sage', color: '#6B8E4E' },
  { id: 'clay', label: 'Clay', color: '#B45309' },
] as const;

export type StorefrontAccentId = (typeof STOREFRONT_ACCENT_OPTIONS)[number]['id'];

export interface VendorThemeSettings {
  accent_color?: StorefrontAccentId;
  pickup_info?: string | null;
  payment_methods?: PaymentMethod[];
  featured_highlight?: string | null;
}

export function parseThemeSettings(raw: Record<string, unknown> | null | undefined): VendorThemeSettings {
  if (!raw || typeof raw !== 'object') return {};
  const payment_methods = Array.isArray(raw.payment_methods)
    ? raw.payment_methods.filter((v): v is PaymentMethod =>
        typeof v === 'string' && (PAYMENT_METHOD_OPTIONS as readonly string[]).includes(v),
      )
    : undefined;

  const accent = raw.accent_color;
  const accent_color =
    typeof accent === 'string' &&
    STOREFRONT_ACCENT_OPTIONS.some((option) => option.id === accent)
      ? (accent as StorefrontAccentId)
      : undefined;

  return {
    accent_color,
    pickup_info: typeof raw.pickup_info === 'string' ? raw.pickup_info : null,
    payment_methods,
    featured_highlight:
      typeof raw.featured_highlight === 'string' ? raw.featured_highlight : null,
  };
}

export function resolveAccentColor(accentId?: StorefrontAccentId | null): string {
  return (
    STOREFRONT_ACCENT_OPTIONS.find((option) => option.id === accentId)?.color ??
    STOREFRONT_ACCENT_OPTIONS[0].color
  );
}

export function isVendorStorefrontPublic(vendor: Vendor): boolean {
  return vendor.approval_status === 'approved';
}
