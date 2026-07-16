import type { AppTab } from '@/components/navigation/app-tabs';

export type { AppTab };

/**
 * Shopper workspace — role-gated (no creator toggle).
 * Explore Map & Feed · Inbox · Following · Orders
 */
export const SHOPPER_TABS: AppTab[] = [
  {
    to: '/explore',
    label: 'Explore',
    icon: 'map',
    matchPaths: ['/shopper/map', '/shopper/explore', '/shopper/home', '/shopper/events', '/shopper/search'],
  },
  {
    to: '/inbox',
    label: 'Inbox',
    icon: 'messages',
    matchPaths: ['/shopper/messages'],
  },
  {
    to: '/following',
    label: 'Following',
    icon: 'feed',
    matchPaths: ['/shopper/feed'],
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: 'orders',
    matchPaths: ['/shopper/orders', '/profile/orders'],
  },
];

/** Map FAB — same Explore markets map. */
export const SHOPPER_MAP_HREF = '/explore';
