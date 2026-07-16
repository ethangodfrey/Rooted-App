import type { AppTab } from '@/components/navigation/app-tabs';

export type { AppTab };

/** Primary shopper tab bar — Map lives on the floating FAB. */
export const SHOPPER_TABS: AppTab[] = [
  { to: '/shopper/home', label: 'Home', icon: 'home' },
  { to: '/shopper/search', label: 'Discover', icon: 'search' },
  { to: '/shopper/messages', label: 'Messages', icon: 'messages' },
  { to: '/shopper/profile', label: 'You', icon: 'profile' },
];

export const SHOPPER_MAP_HREF = '/shopper/map';
