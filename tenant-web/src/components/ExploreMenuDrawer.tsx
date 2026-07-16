'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

export interface ExploreMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  vendorId: string | null;
  vendorName: string;
  apiBaseUrl?: string;
  marketplaceUrl?: string | null;
}

interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  reserve_enabled: boolean;
  media_urls: string[] | null;
  available_quantity_presale: number;
}

interface MenuMarket {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  start_datetime: string;
  end_datetime: string | null;
  timezone: string | null;
  hours_summary: string | null;
}

interface MenuResponse {
  error?: string;
  vendorName?: string;
  products?: MenuProduct[];
  markets?: MenuMarket[];
  market?: { id: string; name: string; start_datetime?: string } | null;
}

const TACTILE_ADD =
  'inline-flex min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 no-underline';

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatSlotDate(iso: string, timeZone?: string | null): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Frosted bottom drawer listing a vendor’s pre-order menu from the explore swipe feed.
 */
export function ExploreMenuDrawer({
  open,
  onClose,
  vendorId,
  vendorName,
  apiBaseUrl = '',
  marketplaceUrl = null,
}: ExploreMenuDrawerProps) {
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(vendorName);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [markets, setMarkets] = useState<MenuMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  const loadMenu = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/explore/menu?vendorId=${encodeURIComponent(id)}`);
        const body = (await res.json().catch(() => null)) as MenuResponse | null;
        if (!res.ok) throw new Error(body?.error || `Menu failed (${res.status})`);
        setDisplayName(body?.vendorName?.trim() || vendorName);
        setProducts(Array.isArray(body?.products) ? body.products : []);
        const nextMarkets = Array.isArray(body?.markets)
          ? body.markets
          : body?.market
            ? [
                {
                  id: body.market.id,
                  name: body.market.name,
                  city: null,
                  state: null,
                  address: null,
                  start_datetime: body.market.start_datetime ?? new Date().toISOString(),
                  end_datetime: null,
                  timezone: null,
                  hours_summary: null,
                },
              ]
            : [];
        setMarkets(nextMarkets);
        setSelectedMarketId(nextMarkets[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load menu');
        setProducts([]);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, vendorName],
  );

  useEffect(() => {
    if (!open || !vendorId) return;
    setDisplayName(vendorName);
    void loadMenu(vendorId);
  }, [open, vendorId, vendorName, loadMenu]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const selectedMarket = useMemo(() => {
    if (!markets.length) return null;
    return markets.find((m) => m.id === selectedMarketId) ?? markets[0];
  }, [markets, selectedMarketId]);

  const marketBase = marketplaceUrl?.replace(/\/$/, '') ?? '';

  return (
    <div
      className={`fixed inset-0 z-[80] transition-opacity duration-300 ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0B1228]/55 backdrop-blur-sm"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 flex h-[85dvh] max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0B1228]/90 shadow-[0_-20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 ease-out pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex shrink-0 flex-col gap-3 px-5 pt-3 pb-4">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-orange-400 uppercase">
                Explore Menu
              </p>
              <h2
                id={titleId}
                className="mt-1 truncate text-2xl font-extrabold tracking-tight text-white"
              >
                {displayName}
              </h2>
              {selectedMarket ? (
                <p className="mt-1 text-sm font-medium text-white/55">
                  Pre-order for {selectedMarket.name}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {markets.length > 0 ? (
            <div>
              <p className="m-0 text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase">
                Pickup market date
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {markets.map((market) => {
                  const selected = market.id === selectedMarket?.id;
                  return (
                    <button
                      key={market.id}
                      type="button"
                      onClick={() => setSelectedMarketId(market.id)}
                      className={`min-w-[9.5rem] shrink-0 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.98] ${
                        selected
                          ? 'border-orange-500/60 bg-orange-500/20'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`block text-[11px] font-extrabold ${
                          selected ? 'text-orange-400' : 'text-white/55'
                        }`}
                      >
                        {formatSlotDate(market.start_datetime, market.timezone)}
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold text-white">
                        {market.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy>
              <div className="h-8 w-8 animate-pulse rounded-full bg-orange-500/40" />
              <p className="text-sm text-white/60">Loading menu…</p>
            </div>
          ) : null}

          {!loading && error ? (
            <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="m-0 text-lg font-bold text-white">No items listed yet</p>
              <p className="m-0 max-w-xs text-sm text-white/55">
                This maker hasn’t published pre-order stock for the Explore menu.
              </p>
            </div>
          ) : null}

          {!loading && products.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 pb-4" role="list">
              {products.map((product) => {
                const reservable = product.reserve_enabled && product.available_quantity_presale > 0;
                const marketQuery =
                  selectedMarket != null
                    ? `?market=${encodeURIComponent(selectedMarket.id)}`
                    : '';
                const href = marketBase
                  ? `${marketBase}/shopper/products/${product.id}${marketQuery}`
                  : null;
                const thumb = product.media_urls?.[0] ?? null;

                return (
                  <li key={product.id} className="flex items-start gap-4 border-0 bg-transparent py-4">
                    <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#121A36]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold tracking-widest text-white/30 uppercase">
                          Item
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="m-0 text-base font-bold tracking-tight text-white">
                          {product.name}
                        </h3>
                        <span className="shrink-0 rounded-lg bg-orange-500/15 px-2.5 py-1 text-xs font-extrabold tracking-wide text-orange-400">
                          {formatUsd(product.price)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/60">
                        {product.description?.trim() || 'Ready for market pickup.'}
                      </p>
                      {product.available_quantity_presale > 0 ? (
                        <p className="mt-1 text-[11px] font-bold tracking-widest text-white/40 uppercase">
                          {product.available_quantity_presale} pre-order available
                        </p>
                      ) : null}
                      {href && reservable ? (
                        <a href={href} className={`${TACTILE_ADD} mt-3 w-full`}>
                          Add to Pre-Order Bag
                        </a>
                      ) : (
                        <button type="button" className={`${TACTILE_ADD} mt-3 w-full`} disabled>
                          {reservable ? 'Open marketplace to order' : 'Unavailable for pre-order'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ExploreMenuDrawer;
