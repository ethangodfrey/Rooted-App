import type { AppTab } from '@/components/navigation/app-tabs';
import { LAUNCH_FEATURES } from '@/config/features';

export type { AppTab };

/**
 * Shopper workspace — role-gated (no creator toggle).
 * Explore Map & Feed · Inbox (optional) · Following · Orders
 */
export function getShopperTabs(): AppTab[] {
  const tabs: AppTab[] = [
    {
      to: '/explore',
      label: 'Explore',
      icon: 'map',
      matchPaths: [
        '/shopper/map',
        '/shopper/explore',
        '/shopper/home',
        '/shopper/events',
        '/shopper/search',
        '/shopper/meet-the-makers',
      ],
    },
  ];

  if (LAUNCH_FEATURES.ENABLE_SHOPPER_INBOX) {
    tabs.push({
      to: '/inbox',
      label: 'Inbox',
      icon: 'messages',
      matchPaths: ['/shopper/messages'],
    });
  }

  tabs.push(
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
  );

  return tabs;
}

/** Launch-pruned shopper tabs (evaluated at module load). */
export const SHOPPER_TABS: AppTab[] = getShopperTabs();

/** Map FAB — same Explore markets map. */
export const SHOPPER_MAP_HREF = '/explore';
