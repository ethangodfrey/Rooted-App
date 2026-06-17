import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';

export function GuestOnly() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
