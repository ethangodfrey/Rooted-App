import type { Vendor } from '@/src/types/database';

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

export function validateVendorApplication(
  input: VendorApplicationInput,
  attested: boolean,
): string | null {
  if (!input.business_name.trim()) return 'Business name is required.';
  if (!input.product_summary.trim()) return 'Describe what you sell.';
  if (!input.category) return 'Pick a product category.';
  if (!input.sell_city.trim()) return 'City is required.';
  if (!input.sell_state.trim()) return 'State is required.';
  if (input.selling_channels.length === 0) return 'Select at least one place you sell.';
  if (!input.instagram_url && !input.website_url) {
    return 'Add Instagram or a website so we can verify your business.';
  }
  if (!attested) return 'Confirm the attestation to submit your application.';
  return null;
}

export interface VerificationCue {
  label: string;
  ok: boolean;
  detail?: string;
}

/** Lightweight admin checklist — manual spot-check, not automated verification. */
export function getVendorVerificationCues(vendor: Vendor): VerificationCue[] {
  const hasLink = Boolean(vendor.instagram_url?.trim() || vendor.website_url?.trim());
  const hasLocation = Boolean(vendor.sell_city?.trim() && vendor.sell_state?.trim());
  const channels = vendor.selling_channels ?? [];
  const hasChannels = channels.length > 0;
  const hasProduct = Boolean(vendor.product_summary?.trim() && vendor.category);

  return [
    {
      label: 'Product & category',
      ok: hasProduct,
      detail: hasProduct
        ? `${vendor.category} — ${vendor.product_summary}`
        : 'Missing product summary or category',
    },
    {
      label: 'Selling location',
      ok: hasLocation,
      detail: hasLocation
        ? `${vendor.sell_city}, ${vendor.sell_state}`
        : 'Missing city or state',
    },
    {
      label: 'Where they sell',
      ok: hasChannels,
      detail: hasChannels
        ? channels.join(', ')
        : 'No selling channels listed',
    },
    {
      label: 'Verifiable link',
      ok: hasLink,
      detail: hasLink
        ? [vendor.instagram_url, vendor.website_url].filter(Boolean).join(' · ')
        : 'No Instagram or website to spot-check',
    },
    {
      label: 'Application submitted',
      ok: Boolean(vendor.application_submitted_at),
      detail: vendor.application_submitted_at
        ? new Date(vendor.application_submitted_at).toLocaleString()
        : 'Incomplete application',
    },
  ];
}

export function isApplicationReadyForReview(vendor: Vendor): boolean {
  return getVendorVerificationCues(vendor).every((cue) => cue.ok);
}

export function isVendorApplicationComplete(vendor: Vendor | null | undefined): boolean {
  return Boolean(vendor?.application_submitted_at && vendor.business_name?.trim());
}
