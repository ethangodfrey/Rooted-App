import type { AppTab } from '@/components/navigation/app-tabs';

/**
 * Vendor workspace — role-gated (no shopper/vendor toggle).
 * Storefront · Hand-offs · Inbox · Network (+ Map via FAB / sidebar Map link)
 */
export const VENDOR_SIDEBAR_TABS: AppTab[] = [
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
    to: '/vendor/network',
    label: 'Network',
    icon: 'explore',
    matchPaths: ['/vendor/procurement'],
  },
];

/** Farmers-market map — same surface as shopper Explore. */
export const VENDOR_MAP_HREF = '/vendor/map';

export function buildVendorMobileTabs(_vendorId: string): AppTab[] {
  return [
    {
      to: '/vendor/storefront',
      label: 'Store',
      icon: 'store',
      matchPaths: ['/vendor/dashboard', '/vendor/products', '/vendor/posts'],
    },
    {
      to: '/vendor/handoffs',
      label: 'Hand-offs',
      icon: 'orders',
      matchPaths: ['/vendor/orders', '/vendor/fulfillment', '/vendor/handoffs'],
    },
    { to: '/vendor/inbox', label: 'Inbox', icon: 'messages' },
    {
      to: '/vendor/network',
      label: 'Network',
      icon: 'explore',
      matchPaths: ['/vendor/procurement'],
    },
  ];
}
