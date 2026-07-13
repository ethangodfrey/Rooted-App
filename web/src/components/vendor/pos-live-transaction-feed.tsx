import { formatDateTime, formatPrice } from '@/lib/format';
import type { PosTransactionRow } from '@/types/pos-transactions';
import { POS_PROVIDER_LABELS } from '@/types/pos-transactions';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import { VendorEmpty, VendorListPanel } from '@/components/vendor/vendor-ui';

export interface PosLiveTransactionFeedProps {
  feed: PosTransactionRow[];
  realtimeStatus: string | null;
  loading?: boolean;
  hasActiveConnection: boolean;
  maxItems?: number;
}

function realtimeLabel(status: string | null): { text: string; tone: 'live' | 'pending' | 'error' } {
  if (!status) return { text: 'Connecting…', tone: 'pending' };
  if (status === 'SUBSCRIBED') return { text: 'Live', tone: 'live' };
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    return { text: 'Reconnecting…', tone: 'error' };
  }
  return { text: status, tone: 'pending' };
}

const toneClasses = {
  live: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  error: 'bg-rose-100 text-rose-800',
};

export function PosLiveTransactionFeed({
  feed,
  realtimeStatus,
  loading = false,
  hasActiveConnection,
  maxItems = 12,
}: PosLiveTransactionFeedProps) {
  const status = realtimeLabel(realtimeStatus);
  const items = feed.slice(0, maxItems);

  if (loading) {
    return (
      <div className="app-loading py-6">
        <div className="app-spinner" />
      </div>
    );
  }

  if (!hasActiveConnection) {
    return (
      <VendorEmpty message="Connect Square, Toast, or Clover to monitor card sales in real time." />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Live transaction feed
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClasses[status.tone]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.tone === 'live' ? 'animate-pulse bg-emerald-500' : 'bg-current opacity-60'}`}
            aria-hidden
          />
          {status.text}
        </span>
      </div>

      {items.length === 0 ? (
        <VendorEmpty message="POS connected — waiting for your first card sale to appear here." />
      ) : (
        <VendorListPanel>
          {items.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center gap-3 border-b border-stone-100 p-3.5 last:border-b-0"
            >
              <IconBadge name="credit-card" tone="amber" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-800">
                  {formatPrice(txn.net_amount)}
                  <span className="ml-1.5 text-xs font-normal text-stone-400">
                    gross {formatPrice(txn.gross_amount)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-stone-500">
                  {formatDateTime(txn.sold_at)} · {POS_PROVIDER_LABELS[txn.provider]}
                  {txn.external_transaction_id
                    ? ` · ${txn.external_transaction_id.slice(0, 8)}…`
                    : ''}
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                New
              </span>
            </div>
          ))}
        </VendorListPanel>
      )}
    </div>
  );
}
