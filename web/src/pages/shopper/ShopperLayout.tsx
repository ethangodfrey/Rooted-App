import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { SHOPPER_MAP_HREF, SHOPPER_TABS } from '@/components/navigation/shopper-tabs';
import { useAuth } from '@/hooks/use-auth';
import { readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isCustomerRole } from '@/lib/role-utils';

/**
 * Shopper workspace shell — Explore / Inbox / Following / Orders.
 * Vendors may enter shopping routes (Explore + checkout) without a mode toggle;
 * their default home remains the vendor dashboard via auth redirect.
 */
export function ShopperLayout() {
  const { user, shopper, session, isProfileLoading } = useAuth();
  const location = useLocation();
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

  const trustedCache =
    session?.user?.id && routeCache?.userId === session.user.id ? routeCache : null;
  const role = user?.role ?? trustedCache?.role ?? null;

  const vendorShopping =
    role === 'vendor' &&
    (location.pathname === '/explore' ||
      location.pathname.startsWith('/explore/') ||
      location.pathname.startsWith('/shopper/cart') ||
      location.pathname.startsWith('/shopper/checkout') ||
      location.pathname.startsWith('/checkout'));

  if (!isCustomerRole(role) && !vendorShopping) {
    return <Navigate to="/app" replace />;
  }

  if (isCustomerRole(role)) {
    const hasInterests = user
      ? (shopper?.interests?.length ?? 0) > 0
      : (trustedCache?.hasInterests ?? false);
    if (!hasInterests) {
      return <Navigate to="/onboarding/interests" replace />;
    }
  }

  return <AppShell role="shopper" tabs={SHOPPER_TABS} mapFabHref={SHOPPER_MAP_HREF} />;
}
