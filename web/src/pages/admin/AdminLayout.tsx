import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { getTrustedAuthCache, readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';

const ADMIN_TABS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'explore' as const },
  { to: '/admin/vendors', label: 'Vendors', icon: 'products' as const },
  { to: '/admin/events', label: 'Events', icon: 'markets' as const },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' as const },
  { to: '/admin/more', label: 'More', icon: 'posts' as const },
];

export function AdminLayout() {
  const { user, session, isProfileLoading } = useAuth();
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

  if (role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return <AppShell role="admin" tabs={ADMIN_TABS} />;
}
