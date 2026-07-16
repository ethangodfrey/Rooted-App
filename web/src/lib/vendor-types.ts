import type { VendorType } from '@/types/database';

/** Primary onboarding personas (subset of VendorType). */
export type VendorPersona = 'farmers_market' | 'home_kitchen' | 'private_chef';

export const VENDOR_PERSONA_OPTIONS: Array<{
  value: VendorPersona;
  emoji: string;
  title: string;
  description: string;
}> = [
  {
    value: 'farmers_market',
    emoji: '🌾',
    title: 'Market Vendor',
    description: 'I sell at physical farmers markets.',
  },
  {
    value: 'home_kitchen',
    emoji: '🍳',
    title: 'Home Chef',
    description: 'I offer prepared meals, batch orders, or cottage food for pickup/delivery.',
  },
  {
    value: 'private_chef',
    emoji: '🔪',
    title: 'Private Chef',
    description: 'I offer private dining, catering, and customized culinary experiences.',
  },
];

export function isVendorPersona(value: string | null | undefined): value is VendorPersona {
  return value === 'farmers_market' || value === 'home_kitchen' || value === 'private_chef';
}

export function vendorTypeLabel(type: VendorType | string | null | undefined): string | null {
  if (!type) return null;
  const labels: Record<string, string> = {
    farmers_market: 'Market Vendor',
    home_kitchen: 'Home Kitchen',
    private_chef: 'Private Chef',
    food_business: 'Food Business',
    caterer: 'Caterer',
    meal_prep: 'Meal Prep',
  };
  return labels[type] ?? type;
}

/** Gold Private Chef badge */
export const PRIVATE_CHEF_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-amber-500/50 bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-200';

/** Warm amber Home Kitchen badge */
export const HOME_KITCHEN_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-orange-700/60 bg-orange-950/70 px-2.5 py-1 text-[11px] font-bold tracking-wide text-orange-200';

export function vendorTypeBadgeClass(type: VendorType | string | null | undefined): string | null {
  if (type === 'private_chef') return PRIVATE_CHEF_BADGE_CLASS;
  if (type === 'home_kitchen') return HOME_KITCHEN_BADGE_CLASS;
  return null;
}

export function vendorTypeBadgeLabel(type: VendorType | string | null | undefined): string | null {
  if (type === 'private_chef') return 'Private Chef';
  if (type === 'home_kitchen') return 'Home Kitchen';
  return null;
}

/** Private chefs book by inquiry — not cart pre-order. */
export function isPrivateChefVendor(type: VendorType | string | null | undefined): boolean {
  return type === 'private_chef';
}
