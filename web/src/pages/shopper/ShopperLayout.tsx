import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';

const SHOPPER_TABS = [
  { to: '/shopper/home', label: 'Discover', icon: '🔍' },
  { to: '/shopper/events', label: 'Events', icon: '📅' },
  { to: '/shopper/map', label: 'Map', icon: '🗺️' },
  { to: '/shopper/feed', label: 'Feed', icon: '📰' },
  { to: '/shopper/profile', label: 'Profile', icon: '👤' },
];

export function ShopperLayout() {
  const { user, shopper, session, isProfileLoading } = useAuth();
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

  if (role !== 'shopper') {
    return <Navigate to="/app" replace />;
  }

  const hasInterests = user
    ? (shopper?.interests?.length ?? 0) > 0
    : (trustedCache?.hasInterests ?? false);

  if (!hasInterests) {
    return <Navigate to="/onboarding/interests" replace />;
  }

  return <AppShell role="shopper" tabs={SHOPPER_TABS} />;
}
