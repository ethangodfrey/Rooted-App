import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { isTabActive, type AppTab } from '@/components/navigation/app-tabs';
import { TabIcon } from '@/components/navigation/TabIcon';
import { ServerStatusBar } from '@/components/layout/ServerStatusBar';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
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

function vendorAvatarLabel(businessName?: string | null, email?: string | null): string {
  const source = businessName?.trim() || email?.trim() || 'V';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function TabBarLink({ tab, pathname }: { tab: AppTab; pathname: string }) {
  const active = isTabActive(tab, pathname);

  const content = (
    <>
      <span className="app-tabbar__icon" aria-hidden="true">
        <TabIcon
          name={tab.icon}
          size={20}
          color={active ? 'var(--color-primary)' : 'var(--color-muted)'}
        />
      </span>
      {active ? <span className="app-tabbar__label">{tab.label}</span> : null}
    </>
  );

  if (tab.external) {
    return (
      <a
        href={tab.to}
        className={`app-tabbar__link${active ? ' active' : ''}`}
        aria-label={tab.label}
      >
        {content}
      </a>
    );
  }

  return (
    <NavLink
      to={tab.to}
      end={!tab.matchPaths?.length}
      className={`app-tabbar__link${active ? ' active' : ''}`}
      aria-label={tab.label}
    >
      {content}
    </NavLink>
  );
}

export function AppShell({
  role,
  tabs,
  mobileTabs,
  mapFabHref,
}: {
  role: 'shopper' | 'vendor' | 'chef' | 'admin';
  tabs: AppTab[];
  /** When set, mobile tab bar uses this subset (e.g. vendor 4-tab bar). */
  mobileTabs?: AppTab[];
  mapFabHref?: string;
}) {
  const { user, vendor, signOut } = useAuth();
  const { itemCount, openDrawer } = useCart();
  const location = useLocation();
  const homeTo = ROLE_HOME[role];
  const nearbyMarketsOpen = useNearbyOpenMarkets();
  const [fabCompact, setFabCompact] = useState(false);

  const tabbarTabs = mobileTabs ?? tabs;
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
          {role === 'shopper' ? (
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--small cart-fab"
              aria-label={`Open presale cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
              onClick={() => openDrawer()}
            >
              Cart
              {itemCount > 0 ? <span className="cart-fab__badge">{itemCount}</span> : null}
            </button>
          ) : null}

          {role === 'vendor' ? (
            <Link
              to="/vendor/profile"
              className="app-topbar__avatar"
              aria-label="Vendor profile"
              title={vendor?.business_name ?? user?.email ?? 'Profile'}
            >
              {vendorAvatarLabel(vendor?.business_name, user?.email)}
            </Link>
          ) : (
            <span className="app-topbar__email">{user?.email}</span>
          )}

          <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {import.meta.env.DEV ? <ServerStatusBar /> : null}

      <div className="app-layout min-w-0">
        <nav className="app-sidebar hidden md:flex md:flex-col" aria-label={`${role} navigation`}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={!tab.matchPaths?.length}
              className={isTabActive(tab, location.pathname) ? 'app-sidebar__link active' : 'app-sidebar__link'}
            >
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

        <main className="app-main min-w-0 w-full pb-32 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="app-tabbar" aria-label={`${role} tabs`}>
        {tabbarTabs.map((tab) => (
          <TabBarLink key={tab.to} tab={tab} pathname={location.pathname} />
        ))}
      </nav>

      {mapFabHref ? (
        <NavLink
          to={mapFabHref}
          className={`app-map-fab fixed bottom-24 right-4 z-40 md:hidden${fabCompact ? ' app-map-fab--compact' : ''}${nearbyMarketsOpen ? ' app-map-fab--pulse' : ''}`}
          aria-label="Open map"
        >
          <TabIcon name="map" size={22} color="var(--color-surface)" />
        </NavLink>
      ) : null}
    </div>
  );
}
