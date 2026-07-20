import type { DeliveryRouteItem } from '@/lib/farmer-logistics';
import { VendorPrimaryButton } from '@/components/vendor/vendor-ui';

type ActiveRoutesProps = {
  routes: DeliveryRouteItem[];
  loading?: boolean;
  confirmingStopId?: string | null;
  reportingId?: string | null;
  onConfirmDropoff: (stopId: string) => void;
  onReportIssue?: (escrowTransactionId: string) => void;
};

function stopTone(status: string): string {
  const upper = status.toUpperCase();
  if (upper === 'DELIVERED') return 'text-emerald-300';
  if (upper === 'FAILED') return 'text-rose-300';
  return 'text-amber-300';
}

/**
 * Active Routes — delivery_stops in dropoff_order with Confirm Dropoff actions.
 */
export function ActiveRoutes({
  routes,
  loading,
  confirmingStopId,
  reportingId,
  onConfirmDropoff,
  onReportIssue,
}: ActiveRoutesProps) {
  if (loading) {
    return (
      <p className="app-subtitle font-mono text-xs uppercase tracking-wide">
        LOADING_ROUTES…
      </p>
    );
  }

  const active = routes.filter(
    (route) =>
      route.status === 'SCHEDULED' ||
      route.status === 'IN_TRANSIT' ||
      route.stops.some((stop) => stop.status === 'PENDING'),
  );

  if (active.length === 0) {
    return (
      <p className="app-subtitle">
        No active routes. Use Route Planner to group ACCEPTED orders into a
        dispatch run.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
        FLEET_UI_ACTIVE · ACTIVE={active.length}
      </p>
      {active.map((route) => (
        <div
          key={route.id}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-widest text-orange-300">
                {route.status}
              </p>
              <p className="m-0 mt-1 text-sm text-zinc-50">
                Dispatch {route.dispatchDate} · Route {route.id.slice(0, 8)}
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase text-white/40">
              {route.stops.length} stop{route.stops.length === 1 ? '' : 's'}
            </span>
          </div>

          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {[...route.stops]
              .sort((a, b) => a.dropoffOrder - b.dropoffOrder)
              .map((stop) => (
                <li
                  key={stop.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p
                      className={`m-0 font-mono text-[11px] font-bold uppercase tracking-widest ${stopTone(stop.status)}`}
                    >
                      #{stop.dropoffOrder} · {stop.status}
                    </p>
                    <p className="m-0 mt-1 text-xs text-white/60">
                      Vendor {stop.vendorId.slice(0, 8)} · Order{' '}
                      {stop.procurementRequestId.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {stop.status === 'PENDING' && stop.escrowTransactionId && onReportIssue ? (
                      <button
                        type="button"
                        className="app-btn app-btn--secondary app-btn--small"
                        disabled={reportingId === stop.escrowTransactionId}
                        onClick={() => onReportIssue(stop.escrowTransactionId!)}
                      >
                        {reportingId === stop.escrowTransactionId
                          ? 'Reporting…'
                          : 'Report Issue'}
                      </button>
                    ) : null}
                    {stop.status === 'PENDING' ? (
                      <VendorPrimaryButton
                        type="button"
                        disabled={confirmingStopId === stop.id}
                        onClick={() => onConfirmDropoff(stop.id)}
                      >
                        {confirmingStopId === stop.id
                          ? 'Confirming…'
                          : 'Confirm Dropoff'}
                      </VendorPrimaryButton>
                    ) : stop.status === 'DELIVERED' ? (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-emerald-300/90">
                        Funds settled
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
