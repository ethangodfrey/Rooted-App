import type { AppTab } from '@/components/navigation/app-tabs';
import { SHOPPER_TABS } from '@/components/navigation/shopper-tabs';
import { VENDOR_SIDEBAR_TABS } from '@/components/navigation/vendor-tabs';

/** Uppercase FAB navigation personas (marketplace + vendor personas). */
export type FabNavRole = 'SHOPPER' | 'VENDOR' | 'FARMER' | 'PRIVATE_CHEF' | 'ADMIN';

const CHEF_FAB_TABS: AppTab[] = [
  { to: '/chef/dashboard', label: 'Home', icon: 'dashboard' },
  { to: '/chef/services', label: 'Services', icon: 'services' },
  { to: '/chef/bookings', label: 'Bookings', icon: 'bookings' },
  { to: '/chef/portfolio', label: 'Portfolio', icon: 'portfolio' },
  { to: '/chef/profile', label: 'Profile', icon: 'profile' },
];

const FARMER_FAB_TABS: AppTab[] = [
  {
    to: '/vendor/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/procurement'],
  },
  {
    to: '/vendor/storefront',
    label: 'Storefront',
    icon: 'store',
    matchPaths: ['/vendor/dashboard', '/vendor/products', '/vendor/posts', '/vendor/inventory'],
  },
  {
    to: '/vendor/handoffs',
    label: 'Hand-offs',
    icon: 'orders',
    matchPaths: ['/vendor/orders', '/vendor/fulfillment', '/vendor/handoffs'],
  },
  { to: '/vendor/inbox', label: 'Inbox', icon: 'messages' },
];

const ADMIN_FAB_TABS: AppTab[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/vendors', label: 'Vendors', icon: 'store' },
  { to: '/admin/events', label: 'Events', icon: 'markets' },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' },
];

/** Role → vertical FAB menu destinations. */
export const FAB_NAV_BY_ROLE: Record<FabNavRole, AppTab[]> = {
  SHOPPER: SHOPPER_TABS,
  VENDOR: VENDOR_SIDEBAR_TABS,
  FARMER: FARMER_FAB_TABS,
  PRIVATE_CHEF: CHEF_FAB_TABS,
  ADMIN: ADMIN_FAB_TABS,
};

export function resolveFabNavRole(input: {
  accountRole?: string | null;
  vendorType?: string | null;
}): FabNavRole {
  const role = (input.accountRole ?? '').toLowerCase();

  if (role === 'admin') return 'ADMIN';
  // Account role `chef` drives PRIVATE_CHEF FAB destinations.
  // Vendor persona `private_chef` still uses the vendor shell routes.
  if (role === 'chef') return 'PRIVATE_CHEF';
  if (role === 'farmer') return 'FARMER';
  if (role === 'vendor') return 'VENDOR';
  return 'SHOPPER';
}

export function fabTabsForRole(role: FabNavRole, override?: AppTab[]): AppTab[] {
  if (override && override.length > 0) return override;
  return FAB_NAV_BY_ROLE[role];
}
