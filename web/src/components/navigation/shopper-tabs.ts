import type { AppTab } from '@/components/navigation/app-tabs';

export type { AppTab };

/** Unified shopper shell — Explore / Inbox / Orders. */
export const SHOPPER_TABS: AppTab[] = [
  {
    to: '/explore',
    label: 'Explore',
    icon: 'explore',
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
