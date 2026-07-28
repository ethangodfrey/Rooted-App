import type { AppTab } from '@/components/navigation/app-tabs';

/** Creator shell — distinct /creator routes (not vendor storefront clones). */
export const CREATOR_TABS: AppTab[] = [
  {
    to: '/creator/listings',
    label: 'Listings',
    icon: 'products',
    matchPaths: ['/creator', '/vendor/products', '/vendor/inventory', '/vendor/leftovers'],
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
