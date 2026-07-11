import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';

export function RequireAuth() {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (isPasswordRecovery && location.pathname !== '/auth/reset-password') {
    return <Navigate to="/auth/reset-password" replace />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
