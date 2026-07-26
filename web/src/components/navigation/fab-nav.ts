import type { AppTab } from '@/components/navigation/app-tabs';

/** Uppercase FAB navigation personas (marketplace + vendor personas). */
export type FabNavRole = 'SHOPPER' | 'VENDOR' | 'FARMER' | 'PRIVATE_CHEF' | 'ADMIN';

/**
 * Primary destination pages for the Floating Action Bar.
 * These are full app pages (Explore, Events nearby, Profile, …),
 * not the legacy compact bottom-tab subset.
 */
const SHOPPER_FAB_PAGES: AppTab[] = [
  {
    to: '/explore',
    label: 'Explore',
    icon: 'map',
    matchPaths: ['/shopper/map', '/shopper/explore', '/shopper/home', '/explore/feed'],
  },
  {
    to: '/shopper/events',
    label: 'Events nearby',
    icon: 'markets',
    matchPaths: ['/shopper/events'],
  },
  {
    to: '/shopper/search',
    label: 'Search',
    icon: 'search',
  },
  {
    to: '/following',
    label: 'Following',
    icon: 'feed',
    matchPaths: ['/shopper/feed'],
  },
  {
    to: '/inbox',
    label: 'Inbox',
    icon: 'messages',
    matchPaths: ['/shopper/messages'],
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: 'orders',
    matchPaths: ['/shopper/orders', '/profile/orders'],
  },
  {
    to: '/shopper/profile',
    label: 'Profile',
    icon: 'profile',
    matchPaths: ['/shopper/profile/edit', '/shopper/saved', '/shopper/rewards'],
  },
];

const VENDOR_FAB_PAGES: AppTab[] = [
  {
    to: '/vendor/storefront',
    label: 'Storefront',
    icon: 'store',
    matchPaths: ['/vendor/dashboard', '/vendor/products', '/vendor/posts', '/vendor/inventory'],
  },
  {
    to: '/vendor/events',
    label: 'Events',
    icon: 'markets',
  },
  {
    to: '/vendor/handoffs',
    label: 'Hand-offs',
    icon: 'orders',
    matchPaths: ['/vendor/orders', '/vendor/fulfillment', '/vendor/handoffs'],
  },
  {
    to: '/vendor/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/procurement'],
  },
  {
    to: '/vendor/inbox',
    label: 'Inbox',
    icon: 'messages',
  },
  {
    to: '/vendor/profile',
    label: 'Profile',
    icon: 'profile',
    matchPaths: ['/vendor/settings', '/vendor/compliance', '/vendor/credentials'],
  },
];

const FARMER_FAB_PAGES: AppTab[] = [
  {
    to: '/vendor/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/procurement'],
  },
  {
    to: '/vendor/events',
    label: 'Events',
    icon: 'markets',
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
  {
    to: '/vendor/inbox',
    label: 'Inbox',
    icon: 'messages',
  },
  {
    to: '/vendor/profile',
    label: 'Profile',
    icon: 'profile',
    matchPaths: ['/vendor/settings'],
  },
];

const CHEF_FAB_PAGES: AppTab[] = [
  { to: '/chef/dashboard', label: 'Home', icon: 'dashboard' },
  { to: '/chef/services', label: 'Services', icon: 'services' },
  { to: '/chef/bookings', label: 'Bookings', icon: 'bookings' },
  { to: '/chef/portfolio', label: 'Portfolio', icon: 'portfolio' },
  { to: '/chef/profile', label: 'Profile', icon: 'profile' },
];

const ADMIN_FAB_PAGES: AppTab[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/vendors', label: 'Vendors', icon: 'store' },
  { to: '/admin/events', label: 'Events', icon: 'markets' },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' },
  { to: '/admin/more', label: 'More', icon: 'posts' },
];

/** Role → Floating Action Bar page destinations. */
export const FAB_NAV_BY_ROLE: Record<FabNavRole, AppTab[]> = {
  SHOPPER: SHOPPER_FAB_PAGES,
  VENDOR: VENDOR_FAB_PAGES,
  FARMER: FARMER_FAB_PAGES,
  PRIVATE_CHEF: CHEF_FAB_PAGES,
  ADMIN: ADMIN_FAB_PAGES,
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
