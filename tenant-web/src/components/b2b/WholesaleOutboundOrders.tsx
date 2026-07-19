'use client';

import { WholesaleDeliveryConfirm } from '@/components/b2b/WholesaleDeliveryConfirm';
import { useWholesaleOutboundOrders } from '@/lib/b2b/useWholesaleOutboundOrders';

export type WholesaleOutboundOrdersProps = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function WholesaleOutboundOrders({
  accessToken,
  apiBaseUrl = '',
}: WholesaleOutboundOrdersProps) {
  const {
    loading,
    actingId,
    error,
    status,
    orders,
    confirmDelivery,
  } = useWholesaleOutboundOrders({ accessToken, apiBaseUrl });

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          B2B Buyer Desk
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Outbound Wholesale Orders
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Track purchases in transit and confirm delivery to settle the wholesale
          ledger.
        </p>
      </header>

      {!accessToken ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-amber-200/90">
          AUTHORIZATION_REQUIRED — pass a Supabase Bearer token via{' '}
          <code className="rounded bg-white/10 px-1">access_token</code>.
        </div>
      ) : null}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-white/50">
          LOADING_OUTBOUND_ORDERS
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
          {error}
        </p>
      ) : null}

      {status ? (
        <p
          className="mt-3 font-mono text-[11px] uppercase tracking-widest text-emerald-300/90"
          data-testid="outbound-order-status"
        >
          {status}
        </p>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-white/50">
          NO_OUTBOUND_ORDERS
        </p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {orders.map((order) => {
          const inTransit = order.STATUS === 'ORDER_SHIPPED_IN_TRANSIT';
          const confirmed = order.STATUS === 'ORDER_DELIVERY_CONFIRMED';
          const busy = actingId === order.ID;
          return (
            <li
              key={order.ID}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5"
              data-testid={`outbound-order-${order.ID}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-white/45">
                    ORDER {order.ID}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    Seller: {order.SELLER_VENDOR_NAME || order.SELLER_VENDOR_ID}
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-sky-300/90">
                    {order.STATUS}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold uppercase tracking-wide">
                  {formatUsdFromCents(order.SUBTOTAL_CENTS)}
                </p>
              </div>

              {(order.CARRIER_NAME || order.TRACKING_NUMBER) && (
                <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-white/55">
                  CARRIER {order.CARRIER_NAME || '—'} — TRACKING{' '}
                  {order.TRACKING_NUMBER || '—'}
                </p>
              )}

              <ul className="mt-4 space-y-1 font-mono text-[11px] uppercase tracking-wide text-white/60">
                {order.ITEMS.map((item) => (
                  <li key={item.ID}>
                    SKU {item.PRODUCT_SKU_ID} — QTY {item.QUANTITY} @{' '}
                    {formatUsdFromCents(item.NEGOTIATED_TIER_UNIT_PRICE)} ={' '}
                    {formatUsdFromCents(item.LINE_TOTAL_CENTS)}
                  </li>
                ))}
              </ul>

              {confirmed ? (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 font-mono text-[11px] uppercase tracking-wide text-emerald-100">
                  <p>ORDER_DELIVERY_CONFIRMED</p>
                  <p className="mt-1 text-white/70">WHOLESALE_LEDGER_SETTLED</p>
                  {order.DELIVERED_AT ? (
                    <p className="mt-1 text-white/55">
                      DELIVERED_AT {order.DELIVERED_AT}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {inTransit ? (
                <WholesaleDeliveryConfirm
                  orderId={order.ID}
                  disabled={busy}
                  submitting={busy}
                  onSubmit={confirmDelivery}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
