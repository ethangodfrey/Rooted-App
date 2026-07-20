import {
  formatUsdFromCents,
  type AdminLedgerItem,
  type AdminLedgerResponse,
} from '@/lib/admin-dashboard';

type GlobalLedgerProps = {
  ledger: AdminLedgerResponse | null;
  loading?: boolean;
  statusFilter: string;
  typeFilter: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onStatusFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onSort: (sortBy: string) => void;
  onPage: (page: number) => void;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'HELD_IN_ESCROW', label: 'Held in escrow' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'CATERING_DEPOSIT', label: 'Catering deposit' },
  { value: 'LOYALTY_BOOST', label: 'Loyalty boost' },
];

function SortHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (sortBy: string) => void;
}) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-mono text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (sortDir === 'asc' ? ' ASC' : ' DESC') : ''}
    </button>
  );
}

/**
 * Global Ledger — paginated financial_transactions for admins.
 */
export function GlobalLedger({
  ledger,
  loading,
  statusFilter,
  typeFilter,
  sortBy,
  sortDir,
  onStatusFilter,
  onTypeFilter,
  onSort,
  onPage,
}: GlobalLedgerProps) {
  const items: AdminLedgerItem[] = ledger?.ITEMS ?? [];

  return (
    <section aria-label="Global ledger">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
          Status
          <select
            className="app-input min-w-[10rem]"
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all-status'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
          Type
          <select
            className="app-input min-w-[10rem]"
            value={typeFilter}
            onChange={(e) => onTypeFilter(e.target.value)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all-type'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto font-mono text-[10px] uppercase tracking-wide text-white/40">
          ADMIN_DASHBOARD_ACTIVE · LEDGER
          {ledger ? ` · ${ledger.TOTAL} rows` : ''}
        </p>
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wide text-white/50">
          LOADING_LEDGER…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/60">No ledger rows match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/[0.04]">
              <tr>
                <th className="px-3 py-2">
                  <SortHeader
                    label="Type"
                    column="transaction_type"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label="Status"
                    column="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
                  Amount
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
                  Net
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-white/8">
                  <td className="px-3 py-2 font-mono text-xs uppercase text-white/85">
                    {row.transactionType}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs uppercase text-white/70">
                    {row.status}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-white/85">
                    {formatUsdFromCents(row.amountCents)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-emerald-200/90">
                    {formatUsdFromCents(row.netAmountCents)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-white/45">
                    {row.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ledger && ledger.TOTAL_PAGES > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            disabled={ledger.PAGE <= 1}
            onClick={() => onPage(ledger.PAGE - 1)}
          >
            Previous
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
            Page {ledger.PAGE} / {ledger.TOTAL_PAGES}
          </span>
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            disabled={ledger.PAGE >= ledger.TOTAL_PAGES}
            onClick={() => onPage(ledger.PAGE + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
