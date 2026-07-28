import type { UserRole } from '@/src/types/database';

/**
 * Canonical platform buyer role: `shopper`.
 * Legacy DB value `customer` is still accepted at read boundaries.
 */
export function isShopperRole(role: UserRole | null | undefined): boolean {
  return role === 'shopper' || role === 'customer';
}

/**
 * @deprecated Prefer `isShopperRole`.
 */
export function isCustomerRole(role: UserRole | null | undefined): boolean {
  return isShopperRole(role);
}

export function roleDisplayName(role: UserRole | null | undefined): string {
  switch (role) {
    case 'customer':
    case 'shopper':
      return 'Shopper';
    case 'vendor':
      return 'Vendor';
    case 'farmer':
      return 'Farmer';
    case 'chef':
      return 'Chef';
    case 'admin':
      return 'Admin';
    default:
      return 'Guest';
  }
}

export function vendorTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const labels: Record<string, string> = {
    farmers_market: 'Farmers Market',
    home_kitchen: 'Home Kitchen',
    food_business: 'Food Business',
    caterer: 'Caterer',
    meal_prep: 'Meal Prep',
    private_chef: 'Private Chef',
    micro_brand: 'Micro Brand',
  };
  return labels[type] ?? type;
}

export function chefServiceTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
