import type { AdminFleetRoute } from '@/lib/admin-dashboard';

type ActiveFleetProps = {
  routes: AdminFleetRoute[];
  loading?: boolean;
};

/**
 * Active Fleet — IN_TRANSIT delivery routes across all farmers.
 */
export function ActiveFleet({ routes, loading }: ActiveFleetProps) {
  if (loading) {
    return (
      <p className="font-mono text-xs uppercase tracking-wide text-white/50">
        LOADING_FLEET…
      </p>
    );
  }

  if (routes.length === 0) {
    return (
      <p className="text-sm text-white/60">
        No routes currently IN_TRANSIT. Scheduled and completed routes stay on
        farmer dispatch boards.
      </p>
    );
  }

  return (
    <div className="space-y-3" aria-label="Active fleet">
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
        ADMIN_DASHBOARD_ACTIVE · IN_TRANSIT={routes.length}
      </p>
      {routes.map((route) => (
        <article
          key={route.id}
          className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="m-0 text-sm font-semibold text-sky-50">
                {route.farmName?.trim() || 'Farm'} · Route {route.id.slice(0, 8)}
              </p>
              <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-sky-100/70">
                Dispatch {route.dispatchDate} · {route.status}
              </p>
            </div>
            <span className="rounded-md border border-sky-400/35 bg-sky-500/20 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-sky-100">
              Pending {route.pendingStops}/{route.totalStops}
            </span>
          </div>
          <p className="m-0 mt-2 font-mono text-[10px] uppercase tracking-wide text-white/45">
            Delivered {route.deliveredStops} · Farmer {route.farmerId.slice(0, 8)}
          </p>
        </article>
      ))}
    </div>
  );
}
