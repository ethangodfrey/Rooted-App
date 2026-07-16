import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isVendorApplicationComplete } from '@/lib/vendor-application';

/**
 * Legacy `/vendor/*` shell — gates role/setup, then defers primary chrome to `/creator`.
 * Nested vendor tool routes still render via Outlet without the old segmented tab bar.
 */
export function VendorLayout() {
  const { user, vendor, session, isProfileLoading } = useAuth();
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

  // Primary vendor home moved to unified creator shell.
  if (
    location.pathname === '/vendor' ||
    location.pathname === '/vendor/dashboard' ||
    location.pathname === '/vendor/products' ||
    location.pathname === '/vendor/fulfillment' ||
    location.pathname === '/vendor/orders' ||
    location.pathname === '/vendor/posts' ||
    location.pathname === '/vendor/profile'
  ) {
    const target =
      location.pathname === '/vendor/fulfillment' || location.pathname === '/vendor/orders'
        ? '/creator/handoffs'
        : location.pathname === '/vendor/profile'
          ? '/creator/settings'
          : location.pathname === '/vendor/posts'
            ? '/inbox'
            : '/creator';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="app-shell">
      <main className="app-main min-w-0 w-full">
        <Outlet />
      </main>
    </div>
  );
}
