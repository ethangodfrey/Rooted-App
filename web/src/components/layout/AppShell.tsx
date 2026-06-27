import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { TabIcon } from '@/components/navigation/TabIcon';
import type { AppTab } from '@/components/navigation/shopper-tabs';
import { ServerStatusBar } from '@/components/layout/ServerStatusBar';
import { useAuth } from '@/hooks/use-auth';
import { useNearbyOpenMarkets } from '@/hooks/use-nearby-open-markets';

import '@/components/ui/ui.css';



const ROLE_HOME: Record<'shopper' | 'vendor' | 'chef' | 'admin', string> = {
  shopper: '/shopper/home',
  vendor: '/vendor/dashboard',
  chef: '/chef/dashboard',
  admin: '/admin/vendors',
};

const SHOPPER_SCREEN_TITLES: Record<string, string> = {
  '/shopper/search': 'Search',
  '/shopper/events': 'Markets',
  '/shopper/profile': 'You',
  '/shopper/feed': 'Updates',
  '/shopper/map': 'Map',
};



export function AppShell({

  role,

  tabs,

  mapFabHref,

}: {

  role: 'shopper' | 'vendor' | 'chef' | 'admin';

  tabs: AppTab[];

  /** When set, shows a floating Map FAB (mobile) + sidebar link (desktop). */

  mapFabHref?: string;

}) {

  const { user, signOut } = useAuth();
  const location = useLocation();
  const homeTo = ROLE_HOME[role];
  const nearbyMarketsOpen = useNearbyOpenMarkets();
  const [fabCompact, setFabCompact] = useState(false);

  const isShopperHome = role === 'shopper' && location.pathname === '/shopper/home';
  const shopperScreenTitle =
    role === 'shopper' ? SHOPPER_SCREEN_TITLES[location.pathname] : undefined;

  useEffect(() => {
    if (role !== 'shopper' || !mapFabHref) return;

    const onScroll = () => {
      setFabCompact(window.scrollY > 48);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [role, mapFabHref, location.pathname]);

  return (
    <div className="app-shell">
      <header className={`app-topbar${shopperScreenTitle ? ' app-topbar--compact' : ''}`}>
        {isShopperHome ? (
          <NavLink to={homeTo} className="app-topbar__brand" aria-label="Vendorly home">
            <Logo size="small" />
          </NavLink>
        ) : shopperScreenTitle ? (
          <h1 className="app-topbar__screen-title">{shopperScreenTitle}</h1>
        ) : (
          <NavLink to={homeTo} className="app-topbar__brand" aria-label="Vendorly home">
            <Logo size="small" />
          </NavLink>
        )}

        <div className="app-topbar__actions">

          <span className="app-topbar__email">{user?.email}</span>

          <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={signOut}>

            Sign out

          </button>

        </div>

      </header>



      {import.meta.env.DEV ? <ServerStatusBar /> : null}



      <div className="app-layout">

        <nav className="app-sidebar" aria-label={`${role} navigation`}>

          {tabs.map((tab) => (

            <NavLink key={tab.to} to={tab.to} end className="app-sidebar__link">

              <TabIcon name={tab.icon} size={18} />

              <span>{tab.label}</span>

            </NavLink>

          ))}

          {mapFabHref ? (

            <NavLink to={mapFabHref} className="app-sidebar__link app-sidebar__link--map">

              <TabIcon name="map" size={18} />

              <span>Map</span>

            </NavLink>

          ) : null}

        </nav>



        <main className="app-main">

          <Outlet />

        </main>

      </div>



      <nav className="app-tabbar" aria-label={`${role} tabs`}>

        {tabs.map((tab) => (

          <NavLink key={tab.to} to={tab.to} end className="app-tabbar__link">

            {({ isActive }) => (

              <>

                <span className="app-tabbar__icon" aria-hidden="true">

                  <TabIcon

                    name={tab.icon}

                    size={20}

                    color={isActive ? 'var(--color-primary)' : 'var(--color-muted)'}

                  />

                </span>

                {isActive ? <span className="app-tabbar__label">{tab.label}</span> : null}

              </>

            )}

          </NavLink>

        ))}

      </nav>



      {mapFabHref ? (
        <NavLink
          to={mapFabHref}
          className={`app-map-fab${fabCompact ? ' app-map-fab--compact' : ''}${nearbyMarketsOpen ? ' app-map-fab--pulse' : ''}`}
          aria-label="Open map"
        >
          <TabIcon name="map" size={22} color="var(--color-surface)" />
        </NavLink>
      ) : null}

    </div>

  );

}

