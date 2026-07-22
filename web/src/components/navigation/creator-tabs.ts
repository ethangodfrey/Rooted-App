import type { AppTab } from '@/components/navigation/app-tabs';

/** Unified creator shell — Feed / Listings / Hand-offs / Settings. */
export const CREATOR_TABS: AppTab[] = [
  {
    to: '/creator/feed',
    label: 'Feed',
    icon: 'feed',
    matchPaths: ['/creator/feed'],
  },
  {
    to: '/creator/listings',
    label: 'Listings',
    icon: 'products',
    matchPaths: ['/creator/listings', '/vendor/products', '/vendor/inventory', '/vendor/leftovers'],
  },
  {
    to: '/creator/handoffs',
    label: 'Hand-offs',
    icon: 'orders',
    matchPaths: ['/vendor/fulfillment', '/vendor/orders'],
  },
  {
    to: '/creator/settings',
    label: 'Settings',
    icon: 'profile',
    matchPaths: ['/vendor/settings', '/vendor/profile', '/vendor/storefront'],
  },
];
