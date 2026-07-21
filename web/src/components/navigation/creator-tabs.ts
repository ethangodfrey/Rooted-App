import type { AppTab } from '@/components/navigation/app-tabs';

/** Unified creator shell — Listings / Hand-offs / Settings. */
export const CREATOR_TABS: AppTab[] = [
  {
    to: '/creator',
    label: 'Listings',
    icon: 'products',
    matchPaths: ['/vendor/products', '/vendor/inventory', '/vendor/leftovers'],
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
