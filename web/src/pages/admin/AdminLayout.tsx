import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';

const ADMIN_TABS = [
  { to: '/admin/vendors', label: 'Vendors', icon: 'products' as const },
  { to: '/admin/events', label: 'Events', icon: 'markets' as const },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' as const },
  { to: '/admin/posts', label: 'Posts', icon: 'posts' as const },
  { to: '/admin/more', label: 'More', icon: 'explore' as const },
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

  const trustedCache =
    session?.user?.id && routeCache?.userId === session.user.id ? routeCache : null;
  const role = user?.role ?? trustedCache?.role ?? null;

  if (role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return <AppShell role="admin" tabs={ADMIN_TABS} />;
}
