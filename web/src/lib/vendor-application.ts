import type { Vendor } from '@/types/database';

export const VENDOR_CATEGORY_OPTIONS = [
  'Food & Drink',
  'Baked Goods',
  'Art & Prints',
  'Jewelry',
  'Apparel',
  'Home & Decor',
  'Plants',
  'Candles & Soap',
  'Vintage & Thrift',
  'Handmade Crafts',
  'Wellness',
  'Pet Goods',
] as const;

export const SELLING_CHANNEL_OPTIONS = [
  'Farmers markets',
  'Craft fairs & pop-ups',
  'Flea markets',
  'Festivals',
  'Online / social',
  'Other local events',
] as const;

export type SellingChannel = (typeof SELLING_CHANNEL_OPTIONS)[number];

export interface VendorApplicationInput {
  business_name: string;
  product_summary: string;
  business_description: string | null;
  category: string;
  sell_city: string;
  sell_state: string;
  selling_channels: SellingChannel[];
  primary_market: string | null;
  instagram_url: string | null;
  website_url: string | null;
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Returns a user-facing error message, or null when the URL is empty or valid. */
export function validateOptionalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeUrl(trimmed);
  if (!normalized) return 'Enter a valid URL (e.g. https://example.com).';
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes('.')) {
      return 'Enter a valid URL (e.g. https://example.com).';
    }
    return null;
  } catch {
    return 'Enter a valid URL (e.g. https://example.com).';
  }
}

export function validateVendorApplicationFields(
  input: VendorApplicationInput,
  attested: boolean,
): Partial<Record<keyof VendorApplicationInput | 'attested' | 'social', string>> {
  const errors: Partial<Record<keyof VendorApplicationInput | 'attested' | 'social', string>> = {};

  if (!input.business_name.trim()) errors.business_name = 'Business name is required.';
  if (!input.product_summary.trim()) errors.product_summary = 'Describe what you sell.';
  if (!input.category) errors.category = 'Pick a product category.';
  if (!input.sell_city.trim()) errors.sell_city = 'City is required.';
  if (!input.sell_state.trim()) errors.sell_state = 'State is required.';
  if (input.selling_channels.length === 0) {
    errors.selling_channels = 'Select at least one place you sell.';
  }
  if (!input.instagram_url && !input.website_url) {
    errors.social = 'Add Instagram or a website so we can verify your business.';
  }
  if (!attested) errors.attested = 'Confirm the attestation to submit your application.';

  return errors;
}

export function validateVendorApplication(
  input: VendorApplicationInput,
  attested: boolean,
): string | null {
  const errors = validateVendorApplicationFields(input, attested);
  return Object.values(errors)[0] ?? null;
}

export function isVendorApplicationComplete(vendor: Vendor | null | undefined): boolean {
  return Boolean(vendor?.application_submitted_at && vendor.business_name?.trim());
}
