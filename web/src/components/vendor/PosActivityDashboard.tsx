import { Link } from 'react-router-dom';

import { useNow } from '@/hooks/use-now';
import { usePosActivityFeed } from '@/hooks/use-pos-activity-feed';
import { formatQueueLatency, formatRelativeTime } from '@/lib/pos-activity';
import type { PosActivityFeedItem, PosLowStockAlert } from '@/types/pos-activity';

import './pos-activity-dashboard.css';

interface PosActivityDashboardProps {
  vendorId: string;
}

function FeedKindBadge({ kind }: { kind: PosActivityFeedItem['kind'] }) {
  const styles: Record<PosActivityFeedItem['kind'], string> = {
    inventory_adjustment: 'bg-emerald-100 text-emerald-800',
    pos_sale: 'bg-sky-100 text-sky-800',
    sync_run: 'bg-violet-100 text-violet-800',
  };
  const labels: Record<PosActivityFeedItem['kind'], string> = {
    inventory_adjustment: 'Stock',
    pos_sale: 'Sale',
    sync_run: 'Sync',
  };
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[kind]}`}>
      {labels[kind]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'emerald' | 'sky' | 'amber' | 'violet';
}) {
  const accentRing =
    accent === 'emerald'
      ? 'ring-emerald-200'
      : accent === 'sky'
        ? 'ring-sky-200'
        : accent === 'amber'
          ? 'ring-amber-200'
          : accent === 'violet'
            ? 'ring-violet-200'
            : 'ring-slate-200';

  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${accentRing}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function LowStockList({ alerts }: { alerts: PosLowStockAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No low-stock alerts in the last 24 hours.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      {alerts.map((alert) => (
        <li key={`${alert.productId}-${alert.eventId}`} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{alert.productName}</p>
            <p className="truncate text-sm text-slate-500">{alert.eventName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold text-amber-600">{alert.quantityRemaining}</p>
            <p className="text-xs text-slate-400">units left</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LiveFeedList({ feed, now }: { feed: PosActivityFeedItem[]; now: Date }) {
  if (feed.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        No POS activity in the last 24 hours. Connect a terminal or wait for the next webhook.
      </p>
    );
  }

  return (
    <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-xl bg-white ring-1 ring-slate-200">
      {feed.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80">
          <FeedKindBadge kind={item.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-slate-800">{item.message}</p>
            <p className="mt-1 text-xs text-slate-400">
              {formatRelativeTime(item.occurredAt, now)}
              {item.provider ? ` · ${item.provider}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Real-time vendor POS activity dashboard.
 * Data is kept fresh via `usePosActivityFeed` (Realtime + polling).
 */
export function PosActivityDashboard({ vendorId }: PosActivityDashboardProps) {
  const now = useNow(30_000);
  const { data, loading, error, refreshing, lastSyncedAt, refresh } = usePosActivityFeed({ vendorId });

  if (loading && !data) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-red-50 px-4 py-6 text-center ring-1 ring-red-200">
        <p className="text-sm font-medium text-red-800">Could not load activity dashboard</p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">
          Retry
        </button>
      </div>
    );
  }

  const metrics = data!.metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Last {metrics.windowHours} hours</p>
          {lastSyncedAt ? (
            <p className="text-xs text-slate-400">
              Updated {formatRelativeTime(lastSyncedAt.toISOString(), now)}
              {refreshing ? ' · syncing…' : ''}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total syncs processed"
          value={metrics.totalSyncsProcessed.toLocaleString()}
          hint={`${metrics.inventorySyncEvents} inventory · ${metrics.transactionSyncRuns} transaction runs`}
          accent="emerald"
        />
        <MetricCard
          label="Active POS terminals"
          value={metrics.activePosTerminals}
          hint="Connected and active"
          accent="sky"
        />
        <MetricCard
          label="Low-stock alerts"
          value={metrics.lowStockAlertCount}
          hint="≤ 5 units after live POS activity"
          accent="amber"
        />
        <MetricCard
          label="Queue latency (avg)"
          value={formatQueueLatency(metrics.queueLatencyMs)}
          hint={
            metrics.queueLatencySampleSize > 0
              ? `Based on ${metrics.queueLatencySampleSize} sync runs`
              : 'No completed sync runs yet'
          }
          accent="violet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">Live feed</h2>
          </div>
          <LiveFeedList feed={data!.feed} now={now} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Low-stock alerts</h2>
          <LowStockList alerts={data!.lowStockAlerts} />
        </section>
      </div>

      <p className="text-center text-xs text-slate-400">
        <Link to="/vendor/pos" className="text-emerald-700 hover:underline">
          Manage POS connections
        </Link>
        {' · '}
        Inventory updates stream via Supabase Realtime; sync metrics poll every 15s.
      </p>
    </div>
  );
}
