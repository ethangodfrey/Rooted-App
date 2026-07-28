import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { NotFoundPage } from '@/pages/NotFoundPage';

type LaunchFeatureGateProps = {
  enabled: boolean;
  children: ReactNode;
  /** When disabled: redirect to explore map, or show 404. */
  fallback?: 'explore' | 'not-found';
};

/**
 * Route-level gate for MVP-pruned surfaces.
 * Disabled features redirect to `/explore` by default (or render 404).
 */
export function LaunchFeatureGate({
  enabled,
  children,
  fallback = 'explore',
}: LaunchFeatureGateProps) {
  if (enabled) return <>{children}</>;
  if (fallback === 'not-found') return <NotFoundPage />;
  return <Navigate to="/explore" replace />;
}
