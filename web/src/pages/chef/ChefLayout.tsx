import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isChefProfileComplete } from '@/lib/chef-profile';

const CHEF_TABS = [
  { to: '/chef/dashboard', label: 'Home', icon: 'dashboard' as const },
  { to: '/chef/services', label: 'Services', icon: 'services' as const },
  { to: '/chef/bookings', label: 'Bookings', icon: 'bookings' as const },
  { to: '/chef/portfolio', label: 'Portfolio', icon: 'portfolio' as const },
  { to: '/chef/profile', label: 'Profile', icon: 'profile' as const },
];

export function ChefLayout() {
  const { user, chef, session, isProfileLoading } = useAuth();
  const location = useLocation();
  const onSetup = location.pathname.startsWith('/chef/setup');
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

  if (role !== 'chef') {
    return <Navigate to="/app" replace />;
  }

  const chefComplete = user
    ? isChefProfileComplete(chef)
    : (trustedCache?.chefComplete ?? false);

  if (!chefComplete && !onSetup) {
    return <Navigate to="/chef/setup" replace />;
  }

  if (onSetup) {
    return <Outlet />;
  }

  return <AppShell role="chef" tabs={CHEF_TABS} />;
}
