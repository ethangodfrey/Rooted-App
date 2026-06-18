import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { resolveAuthRedirect } from '@/lib/auth-redirect';
import { readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';
import { isSupabaseConfigured } from '@/lib/supabase';

export function DashboardRedirect() {
  const { session, user, shopper, vendor, isLoading, isProfileLoading, isPasswordRecovery } =
    useAuth();
  const [routeCache, setRouteCache] = useState<AuthRouteCache | null | undefined>(undefined);

  useEffect(() => {
    readAuthRouteCache().then(setRouteCache);
  }, []);

  if (!isSupabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || routeCache === undefined) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <Navigate to="/auth/reset-password" replace />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const sessionUserId = session.user.id;

  if (isProfileLoading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/onboarding/role-select" replace />;
  }

  const destination = resolveAuthRedirect(
    user,
    shopper,
    vendor,
    routeCache,
    sessionUserId,
    isProfileLoading,
  );

  return <Navigate to={destination ?? '/onboarding/role-select'} replace />;
}
