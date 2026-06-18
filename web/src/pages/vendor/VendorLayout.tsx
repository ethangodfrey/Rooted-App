import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isVendorApplicationComplete } from '@/lib/vendor-application';

const VENDOR_TABS = [
  { to: '/vendor/dashboard', label: 'Home', icon: '🏠' },
  { to: '/vendor/orders', label: 'Orders', icon: '📦' },
  { to: '/vendor/products', label: 'Products', icon: '🛍️' },
  { to: '/vendor/posts', label: 'Posts', icon: '📣' },
  { to: '/vendor/profile', label: 'Profile', icon: '👤' },
];

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

  return <AppShell role="vendor" tabs={VENDOR_TABS} />;
}
