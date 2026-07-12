import type { TabIconName } from '@/components/navigation/TabIcon';

export interface AppTab {
  to: string;
  label: string;
  icon: TabIconName;
  /** Open as a plain anchor (e.g. public storefront outside vendor shell). */
  external?: boolean;
  /** Additional paths that should mark this tab active. */
  matchPaths?: string[];
}

export function isTabActive(tab: AppTab, pathname: string): boolean {
  if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return true;
  return (tab.matchPaths ?? []).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
