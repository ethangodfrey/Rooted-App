import type { UserRole } from '@/src/types/database';

/** Customer role — includes legacy `shopper` values during migration. */
export function isCustomerRole(role: UserRole | null | undefined): boolean {
  return role === 'customer' || role === 'shopper';
}

export function roleDisplayName(role: UserRole | null | undefined): string {
  switch (role) {
    case 'customer':
    case 'shopper':
      return 'Customer';
    case 'vendor':
      return 'Vendor';
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
