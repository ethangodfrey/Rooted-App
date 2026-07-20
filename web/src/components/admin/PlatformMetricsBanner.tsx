import {
  formatUsdFromCents,
  type AdminTelemetry,
} from '@/lib/admin-dashboard';

type PlatformMetricsBannerProps = {
  telemetry: AdminTelemetry | null;
  loading?: boolean;
};

/**
 * Platform Metrics — GMV, Active Escrow, Total Platform Revenue.
 */
export function PlatformMetricsBanner({
  telemetry,
  loading,
}: PlatformMetricsBannerProps) {
  if (loading) {
    return (
      <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-white/45">
        SYSTEM_TELEMETRY_INITIALIZED · LOADING…
      </p>
    );
  }

  const cards = [
    {
      label: 'Total GMV',
      value: formatUsdFromCents(telemetry?.TOTAL_GMV_CENTS ?? 0),
      meta: `${telemetry?.SETTLED_COUNT ?? 0} settled`,
      tone: 'text-emerald-300',
    },
    {
      label: 'Active Escrow',
      value: formatUsdFromCents(telemetry?.ACTIVE_ESCROW_CENTS ?? 0),
      meta: `${telemetry?.ESCROW_COUNT ?? 0} held`,
      tone: 'text-amber-300',
    },
    {
      label: 'Total Platform Revenue',
      value: formatUsdFromCents(telemetry?.PLATFORM_REVENUE_CENTS ?? 0),
      meta: `${telemetry?.PLATFORM_FEE_BPS ?? 500} bps fee`,
      tone: 'text-sky-300',
    },
  ];

  return (
    <section
      className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4"
      aria-label="Platform metrics"
    >
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
        SYSTEM_TELEMETRY_INITIALIZED · PLATFORM_METRICS
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-white/10 bg-[#0B1224]/60 px-3 py-3"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-white/50">
              {card.label}
            </p>
            <p className={`m-0 mt-2 font-mono text-2xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
            <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
              {card.meta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
