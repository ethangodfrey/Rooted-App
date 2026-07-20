import { formatUsdFromCents } from '@/lib/admin-dashboard';
import type { DisputeItem } from '@/lib/disputes';

type DisputeQueueProps = {
  items: DisputeItem[];
  loading?: boolean;
  actingId?: string | null;
  onApproveRefund: (disputeId: string) => void;
  onDismiss: (disputeId: string) => void;
};

/**
 * Admin Dispute Queue — OPEN / IN_REVIEW with refund & dismiss controls.
 */
export function DisputeQueue({
  items,
  loading,
  actingId,
  onApproveRefund,
  onDismiss,
}: DisputeQueueProps) {
  if (loading) {
    return (
      <p className="font-mono text-xs uppercase tracking-wide text-white/50">
        LOADING_DISPUTE_QUEUE…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-white/60">
        No OPEN or IN_REVIEW disputes. Frozen escrow holds appear here when a
        vendor or farmer reports an issue.
      </p>
    );
  }

  return (
    <div className="space-y-3" aria-label="Dispute queue">
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
        DISPUTE_ENGINE_INITIALIZED · QUEUE={items.length}
      </p>
      {items.map((row) => (
        <article
          key={row.id}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-widest text-rose-200">
                {row.status} · {row.transactionStatus}
              </p>
              <p className="m-0 mt-1 text-sm text-zinc-50">{row.reason}</p>
              <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-white/50">
                {row.transactionType} · {formatUsdFromCents(row.netAmountCents)} ·
                TX {row.transactionId.slice(0, 8)}
                {row.referenceId ? ` · REF ${row.referenceId.slice(0, 8)}` : ''}
              </p>
              <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-white/35">
                {row.createdAt.slice(0, 19).replace('T', ' ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="app-btn app-btn--primary app-btn--small"
                disabled={actingId === row.id}
                onClick={() => onApproveRefund(row.id)}
              >
                {actingId === row.id ? 'Working…' : 'Approve Refund'}
              </button>
              <button
                type="button"
                className="app-btn app-btn--secondary app-btn--small"
                disabled={actingId === row.id}
                onClick={() => onDismiss(row.id)}
              >
                Dismiss Dispute
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
