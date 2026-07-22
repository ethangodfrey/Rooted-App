import type { VendorType } from '@/types/database';

/** Primary onboarding personas (subset of VendorType). */
export type VendorPersona =
  | 'farmers_market'
  | 'home_kitchen'
  | 'private_chef'
  | 'micro_brand';

/** Phase 83a uppercase API classifications. */
export type VendorClassification = 'HOME' | 'PRIVATE_CHEF' | 'MICRO_BRAND' | 'FARMERS_MARKET';

export const VENDOR_PERSONA_OPTIONS: Array<{
  value: VendorPersona;
  title: string;
  description: string;
}> = [
  {
    value: 'farmers_market',
    title: 'Market Vendor',
    description: 'I sell at physical farmers markets.',
  },
  {
    value: 'home_kitchen',
    title: 'Home Chef',
    description: 'I offer prepared meals, batch orders, or cottage food for pickup/delivery.',
  },
  {
    value: 'private_chef',
    title: 'Private Chef',
    description: 'I offer private dining, catering, and customized culinary experiences.',
  },
  {
    value: 'micro_brand',
    title: 'Micro-Brand / Maker',
    description: 'I sell physical products, crafts, or apparel.',
  },
];

export function vendorTypeToClassification(
  type: VendorType | string | null | undefined,
): VendorClassification | null {
  if (type === 'home_kitchen') return 'HOME';
  if (type === 'private_chef') return 'PRIVATE_CHEF';
  if (type === 'micro_brand') return 'MICRO_BRAND';
  if (type === 'farmers_market') return 'FARMERS_MARKET';
  return null;
}

export const PRIVATE_CHEF_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-amber-500/50 bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-200';

export const HOME_KITCHEN_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-orange-700/60 bg-orange-950/70 px-2.5 py-1 text-[11px] font-bold tracking-wide text-orange-200';

export const MICRO_BRAND_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-slate-500/50 bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-200';
