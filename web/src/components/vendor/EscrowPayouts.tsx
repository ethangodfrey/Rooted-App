import {
  formatUsdFromCents,
  type FinancialTransactionItem,
} from '@/lib/vendor-financials';

type EscrowPayoutsProps = {
  items: FinancialTransactionItem[];
  loading?: boolean;
  reportingId?: string | null;
  onReportIssue?: (transactionId: string) => void;
};

function statusTone(status: string): string {
  const upper = status.toUpperCase();
  if (upper === 'HELD_IN_ESCROW') return 'text-amber-300';
  if (upper === 'FROZEN') return 'text-rose-300';
  if (upper === 'SETTLED') return 'text-emerald-300';
  if (upper === 'REFUNDED') return 'text-rose-300';
  return 'text-white/70';
}

/**
 * Escrow & Payouts — recent financial_transactions for the vendor wallet.
 */
export function EscrowPayouts({
  items,
  loading,
  reportingId,
  onReportIssue,
}: EscrowPayoutsProps) {
  if (loading) {
    return (
      <p className="app-subtitle font-mono text-xs uppercase tracking-wide">
        LOADING_LEDGER…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="app-subtitle">
        No escrow or payout activity yet. Holds appear as HELD_IN_ESCROW; releases
        as SETTLED.
      </p>
    );
  }

  const held = items.filter((row) => row.status === 'HELD_IN_ESCROW');
  const frozen = items.filter((row) => row.status === 'FROZEN');
  const settled = items.filter((row) => row.status === 'SETTLED');

  return (
    <div className="space-y-4">
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
        ESCROW_LEDGER_ACTIVE · HELD={held.length} FROZEN={frozen.length} SETTLED=
        {settled.length}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={`m-0 font-mono text-[11px] font-bold uppercase tracking-widest ${statusTone(row.status)}`}
                >
                  {row.status}
                </p>
                <p className="m-0 mt-1 text-sm text-zinc-50">
                  {row.transactionType.replace(/_/g, ' ')}
                </p>
                <p className="m-0 mt-1 text-xs text-white/55">
                  Gross {formatUsdFromCents(row.amountCents)}
                  {row.voucherCents > 0
                    ? ` · Loyalty −${formatUsdFromCents(row.voucherCents)}`
                    : ''}
                  {' · '}
                  Net {formatUsdFromCents(row.netAmountCents)}
                </p>
                <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
                  {new Date(row.createdAt).toLocaleString()}
                  {row.referenceId ? ` · REF ${row.referenceId.slice(0, 8)}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-sm font-semibold text-zinc-50">
                  {formatUsdFromCents(row.netAmountCents)}
                </span>
                {row.status === 'HELD_IN_ESCROW' && onReportIssue ? (
                  <button
                    type="button"
                    className="app-btn app-btn--secondary app-btn--small"
                    disabled={reportingId === row.id}
                    onClick={() => onReportIssue(row.id)}
                  >
                    {reportingId === row.id ? 'Reporting…' : 'Report Issue'}
                  </button>
                ) : null}
                {row.status === 'FROZEN' ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-rose-300">
                    ESCROW_FROZEN_ACTIVE
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
