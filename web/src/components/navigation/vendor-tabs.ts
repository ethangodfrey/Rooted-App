import type { AppTab } from '@/components/navigation/app-tabs';

/** Desktop sidebar — full vendor workspace navigation. */
export const VENDOR_SIDEBAR_TABS: AppTab[] = [
  { to: '/vendor/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/vendor/fulfillment', label: 'Fulfillment', icon: 'orders', matchPaths: ['/vendor/orders'] },
  { to: '/vendor/products', label: 'Products', icon: 'products' },
  { to: '/vendor/messages', label: 'Messages', icon: 'messages' },
  { to: '/vendor/posts', label: 'Posts', icon: 'feed' },
  { to: '/vendor/profile', label: 'Profile', icon: 'profile' },
];

export function buildVendorMobileTabs(vendorId: string): AppTab[] {
  return [
    { to: '/vendor/dashboard', label: 'Home', icon: 'dashboard' },
    {
      to: '/vendor/fulfillment',
      label: 'Orders',
      icon: 'orders',
      matchPaths: ['/vendor/orders'],
    },
    { to: '/vendor/messages', label: 'Messages', icon: 'messages' },
    { to: `/vendors/${vendorId}`, label: 'Store', icon: 'store', external: true },
  ];
}
