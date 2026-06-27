import type { TabIconName } from '@/components/navigation/TabIcon';



export interface AppTab {

  to: string;

  label: string;

  icon: TabIconName;

}



/** Primary shopper tab bar — Map lives on the floating FAB. */

export const SHOPPER_TABS: AppTab[] = [

  { to: '/shopper/home', label: 'Home', icon: 'home' },

  { to: '/shopper/search', label: 'Discover', icon: 'search' },

  { to: '/shopper/events', label: 'Markets', icon: 'markets' },

  { to: '/shopper/profile', label: 'You', icon: 'profile' },

];



export const SHOPPER_MAP_HREF = '/shopper/map';


