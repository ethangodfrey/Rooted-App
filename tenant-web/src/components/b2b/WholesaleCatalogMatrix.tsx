'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  formatUsdFromCents,
  normalizePricingTiers,
  resolveUnitPriceCents,
} from '@/lib/b2b/pricing';
import type { WholesaleCatalogResponse, WholesaleProductRow } from '@/lib/b2b/types';

export type WholesaleCatalogMatrixProps = {
  /** Directory vendor whose wholesale catalog to browse. Omit for own catalog. */
  vendorId?: string | null;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

type QtyMap = Record<string, number>;

function asTiers(product: WholesaleProductRow) {
  return normalizePricingTiers(product.PRICING_TIERS);
}

export function WholesaleCatalogMatrix({
  vendorId,
  accessToken,
  apiBaseUrl = '',
}: WholesaleCatalogMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [products, setProducts] = useState<WholesaleProductRow[]>([]);
  const [qtyBySku, setQtyBySku] = useState<QtyMap>({});

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
      setProducts(Array.isArray(body.PRODUCTS) ? body.PRODUCTS : []);
      setVendorName(body.VENDOR_NAME ?? null);
      setHydrated(true);
      if (typeof console !== 'undefined') {
        console.log('B2B_VIEW_HYDRATED COUNT=%s', body.COUNT ?? 0);
      }
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
      const moq = Number(product.MOQ) || 1;
      const qty = qtyBySku[product.ID] ?? moq;
      const priced = resolveUnitPriceCents(qty, product.UNIT_PRICE_CENTS, product.PRICING_TIERS);
      const belowMoq = qty > 0 && qty < moq;
      const tiers = asTiers(product);
      return { product, qty, priced, belowMoq, moq, tiers };
    });
  }, [products, qtyBySku]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          B2B Wholesale Portal
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Wholesale Catalog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Browse bulk inventory with MOQ guards and volume pricing bands.
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

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/55">NO_WHOLESALE_SKUS</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-white/55">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Pack</th>
              <th className="px-4 py-3 font-semibold">Weight</th>
              <th className="px-4 py-3 font-semibold">MOQ</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">Tiers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, qty, priced, belowMoq, moq, tiers }) => {
              const lineCents = priced.unitPriceCents * Math.max(qty, 0);
              return (
                <tr key={product.ID} className="border-t border-white/8 align-top">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-zinc-50">{product.NAME}</div>
                    {product.FREIGHT_NOTES ? (
                      <p className="mt-1 text-xs text-white/45">Freight: {product.FREIGHT_NOTES}</p>
                    ) : null}
                    {product.PICKUP_NOTES ? (
                      <p className="mt-1 text-xs text-white/45">Pickup: {product.PICKUP_NOTES}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs uppercase tracking-wide text-white/70">
                    {product.PACKAGING_UNIT}
                  </td>
                  <td className="px-4 py-4 text-white/75">{product.WEIGHT_LBS} lb</td>
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
                      value={qty}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setQtyBySku((prev) => ({
                          ...prev,
                          [product.ID]: Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0,
                        }));
                        if (typeof console !== 'undefined') {
                          console.log('MOQ_GUARD_ACTIVE SKU=%s', product.ID);
                        }
                      }}
                      className="w-24 rounded-lg border border-white/15 bg-[#121a36] px-3 py-2 font-mono text-sm text-zinc-50"
                      aria-label={`Quantity for ${product.NAME}`}
                    />
                    {belowMoq ? (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-amber-300">
                        MOQ_GUARD_ACTIVE
                      </p>
                    ) : qty >= moq ? (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400/80">
                        MOQ_SATISFIED
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{formatUsdFromCents(priced.unitPriceCents)}</div>
                    {priced.tierMinQty != null ? (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-sky-300/80">
                        TIER @{priced.tierMinQty}+
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
                        BASE_RATE
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {belowMoq ? (
                      <span className="text-white/35">—</span>
                    ) : (
                      formatUsdFromCents(lineCents)
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {tiers.length === 0 ? (
                      <span className="text-xs text-white/40">No volume bands</span>
                    ) : (
                      <ul className="space-y-1 font-mono text-[11px] uppercase tracking-wide text-white/60">
                        {tiers.map((tier) => (
                          <li key={`${product.ID}-${tier.minQty}`}>
                            {tier.minQty}+ → {formatUsdFromCents(tier.unitPriceCents)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
