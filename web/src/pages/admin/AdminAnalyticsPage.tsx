import { Navigate } from 'react-router-dom';

/**
 * Phase 83c — `/admin/analytics` entry.
 * Mix analytics is the primary Phase 83 admin analytics surface.
 */
export function AdminAnalyticsPage() {
  return <Navigate to="/admin/mix-analytics" replace />;
}
