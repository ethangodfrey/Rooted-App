'use client';

import { WholesaleShippingManifest } from '@/components/b2b/WholesaleShippingManifest';
import { useWholesaleInboundOrders } from '@/lib/b2b/useWholesaleInboundOrders';

export type WholesaleInboundOrdersProps = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function WholesaleInboundOrders({
  accessToken,
  apiBaseUrl = '',
}: WholesaleInboundOrdersProps) {
  const {
    loading,
    actingId,
    error,
    status,
    orders,
    acceptOrder,
    rejectOrder,
    fulfillOrder,
  } = useWholesaleInboundOrders({ accessToken, apiBaseUrl });

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          B2B Supplier Desk
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Inbound Wholesale Orders
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Accept drafts to reserve inventory, then attach carrier tracking to
          move accepted orders into transit.
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
          LOADING_INBOUND_ORDERS
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
          data-testid="inbound-order-status"
        >
          {status}
        </p>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-white/50">
          NO_INBOUND_ORDERS
        </p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {orders.map((order) => {
          const isDraft = order.STATUS === 'ORDER_DRAFT_INITIALIZED';
          const isAccepted = order.STATUS === 'ORDER_ACCEPTED_BY_SELLER';
          const isShipped = order.STATUS === 'ORDER_SHIPPED_IN_TRANSIT';
          const busy = actingId === order.ID;
          return (
            <li
              key={order.ID}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5"
              data-testid={`inbound-order-${order.ID}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-white/45">
                    ORDER {order.ID}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    Buyer: {order.BUYER_VENDOR_NAME || order.BUYER_VENDOR_ID}
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-sky-300/90">
                    {order.STATUS}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold uppercase tracking-wide">
                  {formatUsdFromCents(order.SUBTOTAL_CENTS)}
                </p>
              </div>

              <ul className="mt-4 space-y-1 font-mono text-[11px] uppercase tracking-wide text-white/60">
                {order.ITEMS.map((item) => (
                  <li key={item.ID}>
                    SKU {item.PRODUCT_SKU_ID} — QTY {item.QUANTITY} @{' '}
                    {formatUsdFromCents(item.NEGOTIATED_TIER_UNIT_PRICE)} ={' '}
                    {formatUsdFromCents(item.LINE_TOTAL_CENTS)}
                  </li>
                ))}
              </ul>

              {isShipped ? (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 font-mono text-[11px] uppercase tracking-wide text-emerald-100">
                  <p>ORDER_FULFILLMENT_TRACKED</p>
                  <p className="mt-1 text-white/70">
                    CARRIER {order.CARRIER_NAME || '—'} — TRACKING{' '}
                    {order.TRACKING_NUMBER || '—'}
                  </p>
                  {order.ESTIMATED_DELIVERY_AT ? (
                    <p className="mt-1 text-white/55">
                      ETA {order.ESTIMATED_DELIVERY_AT}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!isDraft || busy}
                  onClick={() => {
                    void acceptOrder(order.ID);
                  }}
                  className="inline-flex min-w-[9rem] items-center justify-center rounded-xl bg-emerald-600 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
                  data-testid={`accept-order-${order.ID}`}
                >
                  {busy && isDraft ? 'COMMITTING' : 'ACCEPT ORDER'}
                </button>
                <button
                  type="button"
                  disabled={!isDraft || busy}
                  onClick={() => {
                    void rejectOrder(order.ID);
                  }}
                  className="inline-flex min-w-[9rem] items-center justify-center rounded-xl border border-white/20 bg-transparent px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:text-white/30"
                  data-testid={`reject-order-${order.ID}`}
                >
                  REJECT ORDER
                </button>
              </div>

              {isAccepted ? (
                <WholesaleShippingManifest
                  orderId={order.ID}
                  disabled={busy}
                  submitting={busy}
                  onSubmit={fulfillOrder}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
