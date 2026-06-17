import type { Vendor } from '@/src/types/database';
import { normalizeUrl } from '@/src/lib/vendor-application';

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

export interface StorefrontFormValues {
  business_name: string;
  product_summary: string;
  business_description: string;
  category: string | null;
  logo_url: string | null;
  banner_url: string | null;
  sell_city: string;
  sell_state: string;
  primary_market: string;
  selling_channels: string[];
  instagram_url: string;
  website_url: string;
  pickup_info: string;
  payment_methods: PaymentMethod[];
  featured_highlight: string;
  accent_color: StorefrontAccentId;
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

export function storefrontValuesFromVendor(vendor: Vendor): StorefrontFormValues {
  const theme = parseThemeSettings(vendor.theme_settings);

  return {
    business_name: vendor.business_name ?? '',
    product_summary: vendor.product_summary ?? '',
    business_description: vendor.business_description ?? '',
    category: vendor.category,
    logo_url: vendor.logo_url,
    banner_url: vendor.banner_url,
    sell_city: vendor.sell_city ?? '',
    sell_state: vendor.sell_state ?? '',
    primary_market: vendor.primary_market ?? '',
    selling_channels: vendor.selling_channels ?? [],
    instagram_url: vendor.instagram_url ?? '',
    website_url: vendor.website_url ?? '',
    pickup_info: theme.pickup_info ?? '',
    payment_methods: theme.payment_methods ?? [],
    featured_highlight: theme.featured_highlight ?? '',
    accent_color: theme.accent_color ?? 'forest',
  };
}

export function buildThemeSettings(values: StorefrontFormValues): VendorThemeSettings {
  return {
    accent_color: values.accent_color,
    pickup_info: values.pickup_info.trim() || null,
    payment_methods: values.payment_methods,
    featured_highlight: values.featured_highlight.trim() || null,
  };
}

export function validateStorefront(values: StorefrontFormValues): string | null {
  if (!values.business_name.trim()) return 'Business name is required.';
  if (!values.product_summary.trim()) return 'Add a short tagline about what you sell.';
  if (!values.category) return 'Pick a category.';
  if (!values.sell_city.trim()) return 'City is required.';
  if (!values.sell_state.trim()) return 'State is required.';
  return null;
}

export function storefrontUpdatePayload(values: StorefrontFormValues) {
  return {
    business_name: values.business_name.trim(),
    product_summary: values.product_summary.trim(),
    business_description: values.business_description.trim() || null,
    category: values.category,
    logo_url: values.logo_url,
    banner_url: values.banner_url,
    sell_city: values.sell_city.trim(),
    sell_state: values.sell_state.trim().toUpperCase(),
    primary_market: values.primary_market.trim() || null,
    selling_channels: values.selling_channels,
    instagram_url: normalizeUrl(values.instagram_url),
    website_url: normalizeUrl(values.website_url),
    theme_settings: buildThemeSettings(values),
    updated_at: new Date().toISOString(),
  };
}
