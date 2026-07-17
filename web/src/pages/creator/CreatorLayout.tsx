import { Navigate, useLocation } from 'react-router-dom';

/**
 * Creator workspace boundary (vision: `app/creator` / `/creator/*`).
 *
 * Scaffold: alias into the existing vendor shell until creator-specific pages land.
 * Do not place shopper-only screens here — those stay under `/shopper/*` and
 * shared roots (`/explore`, `/orders`, `/following`, `/inbox`).
 */
export function CreatorLayout() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/creator\/?/, '') || 'storefront';
  const target = suffix.startsWith('vendor/') ? `/${suffix}` : `/vendor/${suffix}`;
  return <Navigate to={target} replace />;
}
