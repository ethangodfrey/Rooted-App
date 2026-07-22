import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CREATOR_TABS } from '@/components/navigation/creator-tabs';
import { isTabActive } from '@/components/navigation/app-tabs';
import { TabIcon } from '@/components/navigation/TabIcon';
import { ServerStatusBar } from '@/components/layout/ServerStatusBar';
import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isVendorApplicationComplete } from '@/lib/vendor-application';

import '@/components/ui/ui.css';

export function CreatorLayout() {
  const { user, vendor, session, isProfileLoading, signOut } = useAuth();
  const location = useLocation();
  const onSetup = location.pathname.startsWith('/vendor/setup');
  const [routeCache, setRouteCache] = useState<AuthRouteCache | null | undefined>(undefined);

  useEffect(() => {
    void readAuthRouteCache().then(setRouteCache);
  }, []);

  if (isProfileLoading || routeCache === undefined) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  const trustedCache = getTrustedAuthCache(routeCache, session?.user?.id, {
    user,
    isProfileLoading,
  });
  const role = user?.role ?? trustedCache?.role ?? null;

  if (!user && !isProfileLoading) {
    return <Navigate to="/onboarding/role-select" replace />;
  }

  // Customers switching into creator mode pick/confirm the vendor role first.
  if (role === 'customer' || role === 'shopper') {
    return <Navigate to="/onboarding/role-select" replace />;
  }

  if (role !== 'vendor') {
    return <Navigate to="/app" replace />;
  }

  const vendorComplete = user
    ? isVendorApplicationComplete(vendor)
    : (trustedCache?.vendorComplete ?? false);

  if (!vendorComplete && !onSetup) {
    return <Navigate to="/vendor/setup" replace />;
  }

  if (onSetup) {
    return <Outlet />;
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/creator" className="app-topbar__brand" aria-label="Creator home">
          <Logo size="small" />
        </Link>

        <div className="app-topbar__actions">
          <Link to="/explore" className="app-btn app-btn--primary app-btn--small">
            Back to Shopping
          </Link>
          <ThemeToggle />
          <span className="app-topbar__email">{user?.email}</span>
          <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {import.meta.env.DEV ? <ServerStatusBar /> : null}

      <div className="app-layout min-w-0">
        <nav className="app-sidebar hidden md:flex md:flex-col" aria-label="Creator navigation">
          {CREATOR_TABS.map((tab) => (
            <NavSidebarLink key={tab.to} tab={tab} pathname={location.pathname} />
          ))}
        </nav>

        <main className="app-main min-w-0 w-full pb-32 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="app-tabbar" aria-label="Creator tabs">
        {CREATOR_TABS.map((tab) => {
          const active = isTabActive(tab, location.pathname);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`app-tabbar__link${active ? ' active' : ''}`}
              aria-label={tab.label}
            >
              <span className="app-tabbar__icon" aria-hidden="true">
                <TabIcon
                  name={tab.icon}
                  size={20}
                  color={active ? 'var(--color-primary)' : 'var(--color-muted)'}
                />
              </span>
              {active ? <span className="app-tabbar__label">{tab.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavSidebarLink({
  tab,
  pathname,
}: {
  tab: (typeof CREATOR_TABS)[number];
  pathname: string;
}) {
  const active = isTabActive(tab, pathname);
  return (
    <Link to={tab.to} className={active ? 'app-sidebar__link active' : 'app-sidebar__link'}>
      <TabIcon name={tab.icon} size={18} />
      <span>{tab.label}</span>
    </Link>
  );
}
