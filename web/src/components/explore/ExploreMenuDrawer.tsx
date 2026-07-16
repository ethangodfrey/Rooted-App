import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MarketSlotPicker } from '@/components/explore/MarketSlotPicker';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/hooks/use-cart';
import { useNow } from '@/hooks/use-now';
import { formatPrice } from '@/lib/format';
import { isProductReservable, type MenuProduct } from '@/lib/product-menu';
import type { PresaleCartMarket } from '@/lib/presale-cart';
import { SNAP_EBT_BADGE_CLASS } from '@/lib/snap-ebt';
import { supabase } from '@/lib/supabase';
import { vendorPath } from '@/lib/market-routes';
import {
  HOME_KITCHEN_BADGE_CLASS,
  isPrivateChefVendor,
  PRIVATE_CHEF_BADGE_CLASS,
  vendorTypeBadgeLabel,
} from '@/lib/vendor-types';
import type { VendorType } from '@/types/database';

export interface ExploreMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  vendorId: string | null;
  vendorName: string;
}

interface MenuMarket extends PresaleCartMarket {
  distanceLabel?: string | null;
}

interface LoadedMenu {
  vendorName: string;
  vendorType: VendorType | null;
  cottageFoodDisclosure: string | null;
  products: MenuProduct[];
  markets: MenuMarket[];
}

const TACTILE_ADD =
  'inline-flex min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Frosted bottom drawer: shopper browses a vendor’s pre-order menu from Explore.
 */
export function ExploreMenuDrawer({
  open,
  onClose,
  vendorId,
  vendorName,
}: ExploreMenuDrawerProps) {
  const titleId = useId();
  const now = useNow(60_000);
  const { addToCart, openDrawer: openCartDrawer, inventoryError, clearInventoryError } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<LoadedMenu | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const loadMenu = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    const [vendorRes, productsRes, marketsRes] = await Promise.all([
      supabase
        .from('vendors')
        .select('id, business_name, vendor_type, cottage_food_disclosure')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('products')
        .select(
          `id, name, description, price, category, reserve_enabled, media_urls, is_snap_eligible,
           product_event_availability(available_quantity_presale)`,
        )
        .eq('vendor_id', id)
        .eq('status', 'active')
        .order('name', { ascending: true }),
      supabase
        .from('vendor_events')
        .select(
          `event:events(
            id, name, city, state, address, start_datetime, end_datetime,
            timezone, hours_summary, sync_metadata
          )`,
        )
        .eq('vendor_id', id)
        .eq('participation_status', 'approved'),
    ]);

    if (vendorRes.error) {
      setError(vendorRes.error.message);
      setMenu(null);
      setLoading(false);
      return;
    }
    if (!vendorRes.data) {
      setError('Vendor not found.');
      setMenu(null);
      setLoading(false);
      return;
    }
    if (productsRes.error) {
      setError(productsRes.error.message);
      setMenu(null);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const markets = ((marketsRes.data ?? []) as unknown as { event: MenuMarket | null }[])
      .map((row) => row.event)
      .filter((event): event is MenuMarket => Boolean(event))
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

    const upcoming = markets.filter((m) => new Date(m.end_datetime || m.start_datetime).getTime() >= now);
    const marketList = upcoming.length > 0 ? upcoming : markets;

    setMenu({
      vendorName: vendorRes.data.business_name?.trim() || vendorName,
      vendorType: (vendorRes.data.vendor_type as VendorType | null) ?? null,
      cottageFoodDisclosure: (vendorRes.data.cottage_food_disclosure as string | null) ?? null,
      products: (productsRes.data as MenuProduct[] | null) ?? [],
      markets: marketList,
    });
    setSelectedMarketId(marketList[0]?.id ?? null);
    setLoading(false);
  }, [vendorName]);

  useEffect(() => {
    if (!open || !vendorId) return;
    void loadMenu(vendorId);
  }, [open, vendorId, loadMenu]);

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

  useEffect(() => {
    if (!open) {
      setAddedId(null);
      setAddingId(null);
      clearInventoryError();
    }
  }, [open, clearInventoryError]);

  const selectedMarket = useMemo(() => {
    if (!menu?.markets.length) return null;
    return menu.markets.find((m) => m.id === selectedMarketId) ?? menu.markets[0];
  }, [menu, selectedMarketId]);

  async function handleAdd(product: MenuProduct) {
    if (!vendorId || !menu) return;
    const market = selectedMarket;
    if (!market) {
      setError('This vendor has no upcoming market for pre-orders yet.');
      return;
    }
    if (!isProductReservable(product)) return;

    setAddingId(product.id);
    setError(null);
    clearInventoryError();
    const ok = await addToCart({
      productId: product.id,
      vendorId,
      vendorName: menu.vendorName,
      market,
      mediaUrl: product.media_urls?.[0] ?? null,
    });
    setAddingId(null);
    if (ok) {
      setAddedId(product.id);
      onClose();
      openCartDrawer();
    }
  }

  const displayName = menu?.vendorName || vendorName;
  const products = menu?.products ?? [];
  const storefrontHref = vendorId ? vendorPath(vendorId) : null;
  const inquireHref = vendorId ? `${vendorPath(vendorId)}?inquire=1` : null;
  const privateChef = isPrivateChefVendor(menu?.vendorType);
  const typeBadge = vendorTypeBadgeLabel(menu?.vendorType ?? null);
  const typeBadgeClass =
    menu?.vendorType === 'private_chef'
      ? PRIVATE_CHEF_BADGE_CLASS
      : menu?.vendorType === 'home_kitchen'
        ? HOME_KITCHEN_BADGE_CLASS
        : null;

  return (
    <div
      className={`explore-menu-drawer fixed inset-0 z-[80] transition-opacity duration-300 ${
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
              {typeBadge && typeBadgeClass ? (
                <span className={`mt-2 ${typeBadgeClass}`}>{typeBadge}</span>
              ) : null}
              {selectedMarket && !privateChef ? (
                <p className="mt-1 text-sm font-medium text-white/55">
                  Pre-order for {selectedMarket.name}
                </p>
              ) : null}
              {privateChef ? (
                <p className="mt-1 text-sm font-medium text-amber-200/80">
                  Private dining & catering — inquire to book a date
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {menu && menu.markets.length > 0 ? (
            <MarketSlotPicker
              markets={menu.markets}
              selectedId={selectedMarket?.id ?? null}
              onSelect={setSelectedMarketId}
              now={now}
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy>
              <div className="h-8 w-8 animate-pulse rounded-full bg-orange-500/40" />
              <p className="text-sm text-white/60">Loading menu…</p>
            </div>
          ) : null}

          {!loading && (error || inventoryError) ? (
            <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200" role="alert">
              {error || inventoryError}
            </p>
          ) : null}

          {!loading && !error && products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="m-0 text-lg font-bold text-white">No items listed yet</p>
              <p className="m-0 max-w-xs text-sm text-white/55">
                This maker hasn’t published pre-order stock for the Explore menu.
              </p>
              {storefrontHref ? (
                <Link
                  to={storefrontHref}
                  onClick={onClose}
                  className={`${TACTILE_ADD} mt-2 w-full max-w-xs no-underline`}
                >
                  View booth profile
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && menu?.cottageFoodDisclosure ? (
            <p className="mb-3 rounded-xl border border-orange-800/50 bg-orange-950/40 px-3 py-2 text-xs leading-relaxed text-orange-100/85">
              {menu.cottageFoodDisclosure}
            </p>
          ) : null}

          {!loading && products.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 pb-4" role="list">
              {products.map((product) => {
                const reservable = isProductReservable(product);
                const adding = addingId === product.id;
                const justAdded = addedId === product.id;
                const presale =
                  product.product_event_availability?.reduce(
                    (sum, row) => sum + (row.available_quantity_presale ?? 0),
                    0,
                  ) ?? 0;

                return (
                  <li
                    key={product.id}
                    className="flex items-start gap-4 border-0 bg-transparent py-4"
                  >
                    <ProductImage
                      src={product.media_urls?.[0]}
                      category={product.category}
                      name={product.name}
                      size={88}
                      rounded="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="m-0 text-base font-bold tracking-tight text-white">
                          {product.name}
                        </h3>
                        <span className="shrink-0 rounded-lg bg-orange-500/15 px-2.5 py-1 text-xs font-extrabold tracking-wide text-orange-400">
                          {formatPrice(product.price)}
                        </span>
                      </div>
                      {product.is_snap_eligible ? (
                        <span className={`mt-1.5 ${SNAP_EBT_BADGE_CLASS}`}>SNAP/EBT Eligible</span>
                      ) : null}
                      {product.description ? (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/60">
                          {product.description}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-sm text-white/45">
                          {privateChef ? 'Available for custom bookings.' : 'Ready for market pickup.'}
                        </p>
                      )}
                      {presale > 0 && !privateChef ? (
                        <p className="mt-1 text-[11px] font-bold tracking-widest text-white/40 uppercase">
                          {presale} pre-order available
                        </p>
                      ) : null}
                      {privateChef && inquireHref ? (
                        <Link
                          to={inquireHref}
                          onClick={onClose}
                          className={`${TACTILE_ADD} mt-3 w-full bg-amber-600 hover:bg-amber-500 no-underline`}
                        >
                          Inquire / Book Date
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={`${TACTILE_ADD} mt-3 w-full`}
                          disabled={!reservable || adding || !selectedMarket}
                          onClick={() => void handleAdd(product)}
                        >
                          {adding
                            ? 'Adding…'
                            : justAdded
                              ? 'Added to bag'
                              : reservable
                                ? 'Add to Pre-Order Bag'
                                : 'Unavailable for pre-order'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {storefrontHref && products.length > 0 ? (
          <div className="shrink-0 border-t border-white/10 px-5 pt-3">
            <Link
              to={storefrontHref}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-white/[0.08] active:scale-[0.98] no-underline"
            >
              Full booth profile
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
