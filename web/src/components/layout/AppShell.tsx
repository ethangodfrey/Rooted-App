import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { isTabActive, type AppTab } from '@/components/navigation/app-tabs';
import { FloatingActionBar } from '@/components/navigation/FloatingActionBar';
import { MapQuickTrigger } from '@/components/navigation/MapQuickTrigger';
import { resolveFabNavRole, type FabNavRole } from '@/components/navigation/fab-nav';
import { TabIcon } from '@/components/navigation/TabIcon';
import { ServerStatusBar } from '@/components/layout/ServerStatusBar';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';

import '@/components/ui/ui.css';

const ROLE_HOME: Record<'shopper' | 'vendor' | 'chef' | 'admin', string> = {
  shopper: '/explore',
  vendor: '/vendor/storefront',
  chef: '/chef/dashboard',
  admin: '/admin/dashboard',
};

const SHOPPER_SCREEN_TITLES: Record<string, string> = {
  '/explore': 'Explore',
  '/explore/feed': 'Explore feed',
  '/inbox': 'Inbox',
  '/following': 'Following',
  '/orders': 'Orders',
  '/shopper/search': 'Search',
  '/shopper/events': 'Events nearby',
  '/shopper/profile': 'Profile',
  '/shopper/feed': 'Updates',
  '/shopper/map': 'Map',
  '/shopper/home': 'Home',
  '/shopper/saved': 'Saved',
  '/shopper/rewards': 'Rewards',
};

function vendorAvatarLabel(businessName?: string | null, email?: string | null): string {
  const source = businessName?.trim() || email?.trim() || 'V';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AppShell({
  role,
  tabs,
  mobileTabs: _mobileTabs,
  mapFabHref,
  fabRole: fabRoleOverride,
}: {
  role: 'shopper' | 'vendor' | 'chef' | 'admin';
  tabs: AppTab[];
  /** @deprecated Legacy mobile tab subset — FAB uses role menus instead. */
  mobileTabs?: AppTab[];
  mapFabHref?: string;
  /** Force FAB persona (e.g. FARMER / CREATOR / PRIVATE_CHEF). */
  fabRole?: FabNavRole;
}) {
  const { user, vendor, signOut } = useAuth();
  const { itemCount, openDrawer } = useCart();
  const location = useLocation();
  const homeTo = ROLE_HOME[role];

  const isShopperHome = role === 'shopper' && location.pathname === '/explore';
  const shopperScreenTitle =
    role === 'shopper' ? SHOPPER_SCREEN_TITLES[location.pathname] : undefined;

  const onMapRoute = Boolean(mapFabHref && location.pathname === mapFabHref);

  const fabRole =
    fabRoleOverride ??
    resolveFabNavRole({
      accountRole: user?.role ?? role,
      vendorType: vendor?.vendor_type,
      pathname: location.pathname,
    });

  return (
    <div className="app-shell">
      <header className={`app-topbar${shopperScreenTitle ? ' app-topbar--compact' : ''}`}>
        {isShopperHome ? (
          <NavLink to={homeTo} className="app-topbar__brand" aria-label="Vendorly home">
            <Logo size="small" />
          </NavLink>
        ) : shopperScreenTitle ? (
          <div>
            <p className="app-eyebrow" style={{ marginBottom: 0 }}>
              {role === 'shopper' ? 'Marketplace' : role}
            </p>
            <h1 className="app-topbar__screen-title">{shopperScreenTitle}</h1>
          </div>
        ) : (
          <NavLink to={homeTo} className="app-topbar__brand" aria-label="Vendorly home">
            <Logo size="small" />
          </NavLink>
        )}

        <div className="app-topbar__actions">
          <ThemeToggle />

          {role === 'shopper' || role === 'vendor' ? <NotificationCenter /> : null}

          {role === 'shopper' || role === 'vendor' ? (
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
              className={
                isTabActive(tab, location.pathname) ? 'app-sidebar__link active' : 'app-sidebar__link'
              }
            >
              <TabIcon name={tab.icon} size={18} />
              <span>{tab.label}</span>
            </NavLink>
          ))}

          {mapFabHref ? (
            <NavLink
              to={mapFabHref}
              className={
                onMapRoute
                  ? 'app-sidebar__link app-sidebar__link--map active'
                  : 'app-sidebar__link app-sidebar__link--map'
              }
            >
              <TabIcon name="map" size={18} />
              <span>Map</span>
            </NavLink>
          ) : null}
        </nav>

        <main className="app-main min-w-0 w-full pb-28 md:pb-0">
          <Outlet />
        </main>
      </div>

      <FloatingActionBar role={fabRole} tabs={role === 'admin' ? tabs : undefined} />

      {mapFabHref ? <MapQuickTrigger href={mapFabHref} /> : null}
    </div>
  );
}
