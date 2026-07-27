import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { TabIcon } from '@/components/navigation/TabIcon';
import { useNearbyOpenMarkets } from '@/hooks/use-nearby-open-markets';

type MapQuickTriggerProps = {
  href: string;
};

/**
 * Persistent bottom-right map trigger — bypasses the FAB menu.
 */
export function MapQuickTrigger({ href }: MapQuickTriggerProps) {
  const location = useLocation();
  const nearbyMarketsOpen = useNearbyOpenMarkets();
  const [compact, setCompact] = useState(false);
  const onMapRoute = location.pathname === href;

  useEffect(() => {
    if (onMapRoute) return;

    const onScroll = () => {
      setCompact(window.scrollY > 48);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [onMapRoute, location.pathname]);

  if (onMapRoute) return null;

  return (
    <NavLink
      to={href}
      className={`fixed bottom-5 right-4 z-50 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-surface)] shadow-[var(--shadow-fab)] transition-all duration-200 ease-out hover:scale-[1.04] active:scale-95 md:hidden ${
        compact ? 'h-12 w-12' : 'h-14 w-14'
      } ${nearbyMarketsOpen ? 'fab-map-trigger--pulse' : ''}`}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Open interactive local map"
      onClick={() => {
        // eslint-disable-next-line no-console
        console.log(`NAVIGATION_UPDATED DEST=${href} LABEL=MAP`);
      }}
    >
      <TabIcon name="map" size={22} color="var(--color-surface)" />
    </NavLink>
  );
}
