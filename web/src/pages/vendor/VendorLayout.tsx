import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { VENDOR_MAP_HREF, VENDOR_SIDEBAR_TABS } from '@/components/navigation/vendor-tabs';
import { resolveFabNavRole } from '@/components/navigation/fab-nav';
import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isVendorApplicationComplete } from '@/lib/vendor-application';
import { NotificationProvider } from '@/providers/notification-provider';

/**
 * Vendor / farmer workspace shell (`/vendor/*`, `/farmer/*`).
 * Real-time notification_logs websocket + live INSERT banner bind here via
 * NotificationProvider so order/B2B alerts reach the creator viewport.
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

  if (role !== 'vendor' && role !== 'farmer') {
    return <Navigate to="/app" replace />;
  }

  const vendorComplete = user
    ? isVendorApplicationComplete(vendor)
    : (trustedCache?.vendorComplete ?? false);

  // Farmers may use the vendor shell network without a vendors-row application.
  if (role === 'vendor' && !vendorComplete && !onSetup) {
    return <Navigate to="/vendor/setup" replace />;
  }

  if (onSetup) {
    return <Outlet />;
  }

  const fabRole = resolveFabNavRole({
    accountRole: role,
    vendorType: vendor?.vendor_type,
    pathname: location.pathname,
  });

  return (
    <NotificationProvider userId={user?.id ?? session?.user?.id}>
      <AppShell
        role="vendor"
        tabs={VENDOR_SIDEBAR_TABS}
        mapFabHref={VENDOR_MAP_HREF}
        fabRole={fabRole}
      />
    </NotificationProvider>
  );
}
