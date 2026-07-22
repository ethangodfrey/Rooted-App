import { AdminMixAnalyticsPage } from '@/pages/admin/AdminMixAnalyticsPage';

/**
 * Phase 83c — `/admin/analytics` marketplace mix analytics visualization.
 * Reuses the mix analytics layout (category donut + recommendations + invites).
 */
export function AdminAnalyticsPage() {
  return (
    <div className="admin-analytics-shell">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">
        PHASE83_UI_INITIALIZED · MARKETPLACE_MIX
      </p>
      <AdminMixAnalyticsPage />
    </div>
  );
}
