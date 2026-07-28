import type { AppTab } from '@/components/navigation/app-tabs';
import { LAUNCH_FEATURES } from '@/config/features';

/** Uppercase FAB navigation personas (marketplace + seller shells). */
export type FabNavRole =
  | 'SHOPPER'
  | 'VENDOR'
  | 'FARMER'
  | 'CREATOR'
  | 'PRIVATE_CHEF'
  | 'ADMIN';

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
    to: '/vendor/analytics',
    label: 'Analytics',
    icon: 'dashboard',
    matchPaths: ['/vendor/analytics/integrations', '/vendor/financials'],
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

/** Farmer shell — logistics + V2V network + procurement (PR #281 routes). */
const FARMER_FAB_PAGES: AppTab[] = [
  {
    to: '/farmer/logistics',
    label: 'Logistics',
    icon: 'orders',
    matchPaths: ['/farmer', '/farmer/logistics'],
  },
  {
    to: '/farmer/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/network'],
  },
  {
    to: '/farmer/procurement',
    label: 'Procurement',
    icon: 'products',
    matchPaths: ['/vendor/procurement'],
  },
  {
    to: '/vendor/analytics',
    label: 'Analytics',
    icon: 'dashboard',
    matchPaths: ['/vendor/analytics/integrations', '/vendor/financials'],
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

/** Creator shell — gated by LAUNCH_FEATURES.ENABLE_CREATOR_ROLE. */
const CREATOR_FAB_PAGES: AppTab[] = [
  {
    to: '/creator/listings',
    label: 'Listings',
    icon: 'products',
    matchPaths: ['/creator', '/vendor/products', '/vendor/inventory'],
  },
  {
    to: '/creator/handoffs',
    label: 'Hand-offs',
    icon: 'orders',
    matchPaths: ['/vendor/fulfillment', '/vendor/orders'],
  },
  {
    to: '/creator/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/network', '/vendor/procurement'],
  },
  {
    to: '/creator/inbox',
    label: 'Inbox',
    icon: 'messages',
    matchPaths: ['/vendor/inbox', '/vendor/messages'],
  },
  {
    to: '/creator/settings',
    label: 'Settings',
    icon: 'profile',
    matchPaths: ['/vendor/settings', '/vendor/profile', '/vendor/storefront'],
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
  CREATOR: CREATOR_FAB_PAGES,
  PRIVATE_CHEF: CHEF_FAB_PAGES,
  ADMIN: ADMIN_FAB_PAGES,
};

function isPrunedFabTab(tab: AppTab): boolean {
  const to = tab.to.toLowerCase();
  if (!LAUNCH_FEATURES.ENABLE_SHOPPER_INBOX && (to === '/inbox' || to.startsWith('/shopper/messages'))) {
    return true;
  }
  if (
    !LAUNCH_FEATURES.ENABLE_COMPLEX_ANALYTICS &&
    (to.includes('/analytics') || to.includes('/financials') || to.includes('mix-analytics'))
  ) {
    return true;
  }
  if (!LAUNCH_FEATURES.ENABLE_VENDOR_POST_VAULT && (to.includes('/posts') || to.includes('/vault'))) {
    return true;
  }
  if (
    !LAUNCH_FEATURES.ENABLE_B2B_INVOICING &&
    (to.includes('/invoice') || to.includes('/invoices'))
  ) {
    return true;
  }
  if (!LAUNCH_FEATURES.ENABLE_CREATOR_ROLE && to.startsWith('/creator')) {
    return true;
  }
  return false;
}

export function resolveFabNavRole(input: {
  accountRole?: string | null;
  vendorType?: string | null;
  pathname?: string | null;
}): FabNavRole {
  const path = input.pathname ?? '';

  // Creator shell disabled for launch — never emit CREATOR menus.
  if (path.startsWith('/creator')) {
    if (!LAUNCH_FEATURES.ENABLE_CREATOR_ROLE) return 'VENDOR';
    return 'CREATOR';
  }
  if (path.startsWith('/farmer')) return 'FARMER';

  const role = (input.accountRole ?? '').toLowerCase();

  if (role === 'admin') return 'ADMIN';
  // Account role `chef` drives PRIVATE_CHEF FAB destinations when chef role is enabled.
  if (role === 'chef') {
    return LAUNCH_FEATURES.ENABLE_CHEF_ROLE ? 'PRIVATE_CHEF' : 'SHOPPER';
  }
  if (role === 'farmer') return 'FARMER';
  if (role === 'vendor') return 'VENDOR';
  return 'SHOPPER';
}

export function fabTabsForRole(role: FabNavRole, override?: AppTab[]): AppTab[] {
  const resolvedRole =
    role === 'CREATOR' && !LAUNCH_FEATURES.ENABLE_CREATOR_ROLE ? 'VENDOR' : role;
  const base =
    override && override.length > 0 ? override : FAB_NAV_BY_ROLE[resolvedRole];
  return base.filter((tab) => !isPrunedFabTab(tab));
}
