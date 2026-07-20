import type { ProcurementRequestItem } from '@/lib/b2b-procurement';
import { VendorPrimaryButton } from '@/components/vendor/vendor-ui';

type RoutePlannerProps = {
  accepted: ProcurementRequestItem[];
  selectedIds: string[];
  dispatchDate: string;
  loading?: boolean;
  dispatching?: boolean;
  onToggle: (requestId: string) => void;
  onDispatchDateChange: (value: string) => void;
  onCreateRoute: () => void;
};

/**
 * Route Planner — select ACCEPTED procurement requests and dispatch a delivery_route.
 */
export function RoutePlanner({
  accepted,
  selectedIds,
  dispatchDate,
  loading,
  dispatching,
  onToggle,
  onDispatchDateChange,
  onCreateRoute,
}: RoutePlannerProps) {
  if (loading) {
    return (
      <p className="app-subtitle font-mono text-xs uppercase tracking-wide">
        LOADING_ACCEPTED_ORDERS…
      </p>
    );
  }

  if (accepted.length === 0) {
    return (
      <p className="app-subtitle">
        No ACCEPTED wholesale orders ready to dispatch. Accept procurement requests
        first, then group them here.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/45">
        ROUTE_DISPATCH_INITIALIZED · ACCEPTED={accepted.length}
      </p>

      <label className="mb-4 block max-w-xs">
        <span className="app-eyebrow">Dispatch date</span>
        <input
          type="date"
          className="app-input mt-1 w-full"
          value={dispatchDate}
          onChange={(e) => onDispatchDateChange(e.target.value)}
          aria-label="Dispatch date"
        />
      </label>

      <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        {accepted.map((row) => {
          const checked = selectedIds.includes(row.id);
          return (
            <li
              key={row.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => onToggle(row.id)}
                  aria-label={`Select order ${row.itemName ?? row.id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold text-zinc-50">
                    {row.itemName ?? 'Wholesale order'} ·{' '}
                    {row.vendorName ?? 'Vendor'}
                  </p>
                  <p className="m-0 mt-1 text-xs text-white/55">
                    {row.requestedQuantity != null
                      ? `Qty ${row.requestedQuantity} · `
                      : ''}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                  <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-orange-300/90">
                    ACCEPTED · {row.id.slice(0, 8)}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <VendorPrimaryButton
        type="button"
        disabled={dispatching || selectedIds.length === 0}
        onClick={onCreateRoute}
      >
        {dispatching
          ? 'Creating route…'
          : `Create route (${selectedIds.length} stop${selectedIds.length === 1 ? '' : 's'})`}
      </VendorPrimaryButton>
    </div>
  );
}
