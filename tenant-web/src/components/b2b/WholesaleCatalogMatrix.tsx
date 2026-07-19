'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  evaluateWholesalePricing,
  formatTierBandRange,
  formatUsdFromCents,
} from '@/lib/b2b/pricing';
import type { WholesaleCatalogResponse, WholesaleProductRow } from '@/lib/b2b/types';
import { useWholesaleOrder } from '@/lib/b2b/useWholesaleOrder';

export type WholesaleCatalogMatrixProps = {
  /** Directory vendor whose wholesale catalog to browse. Omit for own catalog. */
  vendorId?: string | null;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

type QtyMap = Record<string, number>;
type OrderDraft = Record<string, number>;

export function WholesaleCatalogMatrix({
  vendorId,
  accessToken,
  apiBaseUrl = '',
}: WholesaleCatalogMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [buyerVendorId, setBuyerVendorId] = useState<string | null>(null);
  const [sellerVendorId, setSellerVendorId] = useState<string | null>(
    vendorId?.trim() || null,
  );
  const [products, setProducts] = useState<WholesaleProductRow[]>([]);
  const [qtyBySku, setQtyBySku] = useState<QtyMap>({});
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({});
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const {
    canDispatch,
    submitting,
    error: draftError,
    status: draftStatus,
    order: initializedOrder,
    initializeOrder,
  } = useWholesaleOrder({
    buyerVendorId,
    sellerVendorId,
    accessToken,
    apiBaseUrl,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (vendorId?.trim()) params.set('vendorId', vendorId.trim());
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${apiBaseUrl}/api/vendors/wholesale-products${params.size ? `?${params}` : ''}`,
        { headers, cache: 'no-store' },
      );
      const body = (await res.json()) as WholesaleCatalogResponse;
      if (!res.ok) {
        throw new Error(body.error || `WHOLESALE_CATALOG_HTTP_${res.status}`);
      }
      const nextProducts = Array.isArray(body.PRODUCTS) ? body.PRODUCTS : [];
      setProducts(nextProducts);
      setVendorName(body.VENDOR_NAME ?? null);
      setBuyerVendorId(body.SESSION_VENDOR_ID ?? null);
      setSellerVendorId(
        body.VIEW === 'PEER'
          ? body.VENDOR_ID ?? vendorId?.trim() ?? null
          : body.VENDOR_ID ?? null,
      );
      setQtyBySku((prev) => {
        const next: QtyMap = { ...prev };
        for (const product of nextProducts) {
          if (next[product.ID] == null) {
            next[product.ID] = Number(product.MOQ) || 1;
          }
        }
        return next;
      });
      setHydrated(true);
      // eslint-disable-next-line no-console
      console.log('B2B_VIEW_HYDRATED COUNT=%s', body.COUNT ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WHOLESALE_CATALOG_LOAD_FAILED');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    return products.map((product) => {
      // Schema field: wholesale_products.moq (minimum_order_quantity).
      const moq = Number(product.MOQ) || 1;
      const qty = qtyBySku[product.ID] ?? moq;
      const priced = evaluateWholesalePricing({
        quantity: qty,
        moq,
        baseUnitPriceCents: product.UNIT_PRICE_CENTS,
        tiersRaw: product.PRICING_TIERS,
      });
      return { product, priced, moq };
    });
  }, [products, qtyBySku]);

  const anyMoqGuard = rows.some((row) => row.priced.moqGuardActive);
  const runningTotalCents = useMemo(() => {
    return rows.reduce((sum, row) => {
      const drafted = orderDraft[row.product.ID];
      if (drafted == null) return sum;
      const evaled = evaluateWholesalePricing({
        quantity: drafted,
        moq: row.moq,
        baseUnitPriceCents: row.product.UNIT_PRICE_CENTS,
        tiersRaw: row.product.PRICING_TIERS,
      });
      return sum + evaled.lineTotalCents;
    }, 0);
  }, [orderDraft, rows]);

  const queuedLines = useMemo(() => {
    return rows
      .filter((row) => orderDraft[row.product.ID] != null)
      .map((row) => ({
        product: row.product,
        quantity: orderDraft[row.product.ID]!,
      }));
  }, [orderDraft, rows]);

  const updateQty = useCallback((product: WholesaleProductRow, nextQty: number) => {
    const moq = Number(product.MOQ) || 1;
    const qty = Number.isFinite(nextQty) ? Math.max(0, Math.floor(nextQty)) : 0;
    setQtyBySku((prev) => ({ ...prev, [product.ID]: qty }));
    setOrderMessage(null);

    const priced = evaluateWholesalePricing({
      quantity: qty,
      moq,
      baseUnitPriceCents: product.UNIT_PRICE_CENTS,
      tiersRaw: product.PRICING_TIERS,
    });

    if (priced.moqGuardActive) {
      // eslint-disable-next-line no-console
      console.log(
        `MOQ_GUARD_ACTIVE SKU=${product.ID} QTY=${qty} MOQ=${moq}`,
      );
    } else if (priced.tierMinQty != null) {
      // eslint-disable-next-line no-console
      console.log(
        `PRICING_TIER_MATCHED SKU=${product.ID} TIER=${priced.tierLabel} UNIT_CENTS=${priced.unitPriceCents} LINE_CENTS=${priced.lineTotalCents}`,
      );
    } else if (priced.moqSatisfied && qty > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `PRICING_TIER_MATCHED SKU=${product.ID} TIER=BASE_RATE UNIT_CENTS=${priced.unitPriceCents} LINE_CENTS=${priced.lineTotalCents}`,
      );
    }
  }, []);

  const addToWholesaleOrder = useCallback(
    (productId: string, qty: number, moqGuardActive: boolean) => {
      if (moqGuardActive || qty <= 0) {
        // eslint-disable-next-line no-console
        console.log(`MOQ_GUARD_ACTIVE SKU=${productId} ACTION=ADD_BLOCKED`);
        setOrderMessage('MOQ_GUARD_ACTIVE');
        return;
      }
      setOrderDraft((prev) => ({ ...prev, [productId]: qty }));
      setOrderMessage(`WHOLESALE_LINE_QUEUED SKU=${productId} QTY=${qty}`);
      // eslint-disable-next-line no-console
      console.log(`WHOLESALE_LINE_QUEUED SKU=${productId} QTY=${qty}`);
    },
    [],
  );

  const onInitializeOrder = useCallback(async () => {
    if (queuedLines.length === 0) {
      setOrderMessage('WHOLESALE_ORDER_VALIDATION_ERROR: ITEMS REQUIRED');
      return;
    }
    const result = await initializeOrder(queuedLines);
    if (result?.STATUS === 'ORDER_DRAFT_INITIALIZED') {
      setOrderMessage(
        `ORDER_DRAFT_INITIALIZED ID=${result.ORDER?.ID ?? 'UNKNOWN'}`,
      );
      setOrderDraft({});
    }
  }, [initializeOrder, queuedLines]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          B2B Wholesale Portal
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Wholesale Catalog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Live MOQ grid with multi-tier volume pricing. Adjust quantity to recompute unit and line
          totals before order initialization.
          {vendorName ? ` Partner: ${vendorName}.` : null}
        </p>
        {hydrated ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-emerald-400/90">
            B2B_VIEW_HYDRATED
          </p>
        ) : null}
      </header>

      {!accessToken ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-amber-200/90">
          AUTHORIZATION_REQUIRED — pass a Supabase Bearer token via{' '}
          <code className="rounded bg-white/10 px-1">access_token</code> to load wholesale SKUs.
        </div>
      ) : null}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-white/50">LOADING_CATALOG</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
          {error}
        </p>
      ) : null}

      {anyMoqGuard ? (
        <div
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-100"
          role="status"
          data-testid="moq-guard-banner"
        >
          MOQ_GUARD_ACTIVE — increase unit volume to meet minimum_order_quantity before adding
          lines.
        </div>
      ) : null}

      {orderMessage ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-sky-300/90">
          {orderMessage}
        </p>
      ) : null}

      {draftError ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-rose-300">
          {draftError}
        </p>
      ) : null}

      {draftStatus === 'ORDER_DRAFT_INITIALIZED' && initializedOrder ? (
        <p
          className="mt-3 font-mono text-[11px] uppercase tracking-widest text-emerald-300/90"
          data-testid="order-draft-initialized"
        >
          ORDER_DRAFT_INITIALIZED ID={initializedOrder.ID} SUBTOTAL_CENTS=
          {initializedOrder.SUBTOTAL_CENTS}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/55">NO_WHOLESALE_SKUS</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-white/55">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Pack</th>
              <th className="px-4 py-3 font-semibold">MOQ</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">Tiers</th>
              <th className="px-4 py-3 font-semibold">Order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, priced, moq }) => {
              const queued = orderDraft[product.ID] != null;
              return (
                <tr key={product.ID} className="border-t border-white/8 align-top">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-zinc-50">{product.NAME}</div>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
                      {product.WEIGHT_LBS} LB / {product.PACKAGING_UNIT}
                    </p>
                    {product.FREIGHT_NOTES ? (
                      <p className="mt-1 text-xs text-white/45">Freight: {product.FREIGHT_NOTES}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs uppercase tracking-wide text-white/70">
                    {product.PACKAGING_UNIT}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-orange-500/15 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-orange-300">
                      MOQ {moq}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={priced.quantity}
                      onChange={(event) => {
                        updateQty(product, Number(event.target.value));
                      }}
                      className="w-24 rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm text-zinc-50"
                      aria-label={`Quantity for ${product.NAME}`}
                    />
                    {priced.moqGuardActive ? (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-amber-300">
                        MOQ_GUARD_ACTIVE
                      </p>
                    ) : priced.moqSatisfied && priced.quantity > 0 ? (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400/80">
                        MOQ_SATISFIED
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">
                      {formatUsdFromCents(priced.unitPriceCents)}
                    </div>
                    <p
                      className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${
                        priced.tierMinQty != null
                          ? 'text-sky-300/90'
                          : 'text-white/40'
                      }`}
                    >
                      {priced.tierMinQty != null
                        ? `PRICING_TIER_MATCHED ${priced.tierLabel}`
                        : 'BASE_RATE'}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {priced.moqGuardActive || priced.quantity === 0 ? (
                      <span className="text-white/35">—</span>
                    ) : (
                      formatUsdFromCents(priced.lineTotalCents)
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {priced.bands.length === 0 ? (
                      <span className="text-xs text-white/40">NO_VOLUME_BANDS</span>
                    ) : (
                      <ul className="space-y-1 font-mono text-[11px] uppercase tracking-wide text-white/60">
                        {priced.bands.map((band) => {
                          const active =
                            priced.quantity >= band.minQty &&
                            (band.maxQty == null || priced.quantity <= band.maxQty);
                          return (
                            <li
                              key={`${product.ID}-${band.minQty}`}
                              className={active ? 'text-sky-300' : undefined}
                            >
                              {formatTierBandRange(band)} →{' '}
                              {formatUsdFromCents(band.unitPriceCents)}
                              {active ? ' ACTIVE' : ''}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      disabled={priced.moqGuardActive || priced.quantity <= 0}
                      onClick={() =>
                        addToWholesaleOrder(
                          product.ID,
                          priced.quantity,
                          priced.moqGuardActive,
                        )
                      }
                      className="inline-flex w-full min-w-[9.5rem] items-center justify-center rounded-xl bg-orange-600 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
                      data-testid={`add-wholesale-${product.ID}`}
                    >
                      {queued ? 'QUEUED_IN_ORDER' : 'ADD TO WHOLESALE ORDER'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/55">
            ORDER_DRAFT_LINES {Object.keys(orderDraft).length}
          </p>
          <p className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-50">
            RUNNING_TOTAL {formatUsdFromCents(runningTotalCents)}
          </p>
        </div>
        <button
          type="button"
          disabled={
            submitting ||
            !canDispatch ||
            queuedLines.length === 0 ||
            anyMoqGuard
          }
          onClick={() => {
            void onInitializeOrder();
          }}
          className="inline-flex min-w-[12rem] items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
          data-testid="initialize-wholesale-order"
        >
          {submitting ? 'DISPATCHING_DRAFT' : 'INITIALIZE ORDER'}
        </button>
      </footer>
    </section>
  );
}
