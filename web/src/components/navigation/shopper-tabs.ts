import type { AppTab } from '@/components/navigation/app-tabs';

export type { AppTab };

/**
 * Unified shopper shell — Explore / Inbox / Orders.
 * Explore is the farmers-market map + list (all public market events).
 */
export const SHOPPER_TABS: AppTab[] = [
  {
    to: '/explore',
    label: 'Explore',
    icon: 'map',
    matchPaths: ['/shopper/home', '/shopper/map', '/shopper/explore', '/shopper/search', '/shopper/events'],
  },
  {
    to: '/inbox',
    label: 'Inbox',
    icon: 'messages',
    matchPaths: ['/shopper/messages', '/shopper/feed'],
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: 'orders',
    matchPaths: ['/shopper/orders', '/profile/orders'],
  },
];

/** Floating map control — jumps back to the farmers-market Explore map. */
export const SHOPPER_MAP_HREF = '/explore';
