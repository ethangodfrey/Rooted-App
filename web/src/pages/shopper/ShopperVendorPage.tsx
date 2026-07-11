import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CartCheckoutSlider } from '@/components/checkout/CartCheckoutSlider';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { VendorProductMenu } from '@/components/vendor/VendorProductMenu';
import { VendorStorefrontSkeleton } from '@/components/vendor/VendorStorefrontSkeleton';
import { useAuth } from '@/hooks/use-auth';
import { useNow } from '@/hooks/use-now';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { useVendorStorefront } from '@/hooks/use-vendor-storefront';
import { formatEventDisplayDate, formatPrice } from '@/lib/format';
import { marketPath, vendorPath } from '@/lib/market-routes';
import type { MenuProduct } from '@/lib/product-menu';
import {
  cartLineCount,
  cartSubtotal,
  loadStorefrontCart,
  saveStorefrontCart,
  upsertCartLine,
  type StorefrontCart,
} from '@/lib/storefront-cart';
import {
  parseThemeSettings,
  resolveAccentColor,
} from '@/lib/vendor-storefront';

export function ShopperVendorPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow(60_000);
  const { user } = useAuth();
  const { isSaved, toggle, pending } = useSavedVendors();
  const { vendor, products, upcomingMarkets, distanceLabel, loading, error } =
    useVendorStorefront(id);
  const [cart, setCart] = useState<StorefrontCart | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const accent = useMemo(() => {
    if (!vendor) return '#228B22';
    const theme = parseThemeSettings(vendor.theme_settings);
    return resolveAccentColor(theme.accent_color);
  }, [vendor]);

  const bannerUrl = vendor?.banner_url ?? vendor?.logo_url ?? null;

  const persistCart = useCallback((next: StorefrontCart) => {
    setCart(next);
    saveStorefrontCart(next);
  }, []);

  const handleAddToCart = useCallback(
    (product: MenuProduct) => {
      if (!vendor || !id || !product.reserve_enabled) return;
      const base: StorefrontCart =
        cart ??
        ({
          vendorId: id,
          vendorName: vendor.business_name ?? 'Vendor',
          eventId: null,
          eventName: null,
          lines: [],
          updatedAt: new Date().toISOString(),
        } as StorefrontCart);

      persistCart(
        upsertCartLine(base, {
          productId: product.id,
          name: product.name,
          price: product.price,
          mediaUrl: product.media_urls?.[0] ?? null,
          quantity: 1,
        }),
      );
    },
    [cart, id, persistCart, vendor],
  );

  useEffect(() => {
    if (!id || !vendor) return;
    setCart(
      loadStorefrontCart(id) ?? {
        vendorId: id,
        vendorName: vendor.business_name ?? 'Vendor',
        eventId: null,
        eventName: null,
        lines: [],
        updatedAt: new Date().toISOString(),
      },
    );
  }, [id, vendor]);

  const lineCount = useMemo(() => cartLineCount(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  if (loading) {
    return <VendorStorefrontSkeleton />;
  }

  if (error || !vendor || !id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? 'Vendor not found.'}</p>
        <Link to="/shopper/home" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const saved = isSaved(id);

  return (
    <div className="mx-auto max-w-3xl pb-24 sm:px-6">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          to="/shopper/home"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back
        </Link>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={pending}
          onClick={() => toggle(id)}
        >
          {saved ? '♥ Saved' : '♡ Save vendor'}
        </button>
      </div>

      <div
        className="relative h-36 w-full overflow-hidden sm:h-44"
        style={{
          background: bannerUrl
            ? `url(${bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}22 0%, ${accent}44 100%)`,
        }}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 px-4">
          {vendor.logo_url ? (
            <img
              src={vendor.logo_url}
              alt=""
              className="h-14 w-14 rounded-xl border-2 border-white object-cover shadow-md sm:h-16 sm:w-16"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-white text-lg font-bold text-white shadow-md sm:h-16 sm:w-16"
              style={{ backgroundColor: accent }}
            >
              {(vendor.business_name ?? 'V').charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1 text-white">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{vendor.business_name}</h1>
            {vendor.category ? (
              <p className="truncate text-sm text-white/90">{vendor.category}</p>
            ) : null}
            <TrustBadges userId={vendor.user_id} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        {distanceLabel ? (
          <p className="mb-3 text-sm font-medium text-emerald-700">{distanceLabel} away</p>
        ) : null}
        {vendor.business_description ? (
          <p className="mb-4 text-sm leading-relaxed text-stone-600">{vendor.business_description}</p>
        ) : null}
        {vendor.product_summary ? (
          <p className="mb-6 text-sm text-stone-500">{vendor.product_summary}</p>
        ) : null}

        {upcomingMarkets.length > 0 ? (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Upcoming markets
            </h2>
            <ul className="space-y-2">
              {upcomingMarkets.map((m) => (
                <li key={m.id}>
                  <Link
                    to={marketPath(m.id)}
                    className="block rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
                  >
                    <span className="font-medium text-stone-900">{m.name}</span>
                    {formatEventDisplayDate(m, now) ? (
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {formatEventDisplayDate(m, now)}
                      </span>
                    ) : null}
                    {m.distanceLabel ? (
                      <span className="mt-0.5 block text-xs font-medium text-emerald-700">
                        {m.distanceLabel} away
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <h2 className="mb-3 text-lg font-semibold text-stone-900">Menu</h2>
        <VendorProductMenu
          products={products}
          accentColor={accent}
          onAddToCart={handleAddToCart}
        />

        <ReviewsSection targetType="vendor" targetId={id} />
      </div>

      {lineCount > 0 && cart ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-auto sm:max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {lineCount} in cart · {formatPrice(subtotal)}
              </p>
              <p className="text-xs text-slate-500">Synced with vendor POS on checkout</p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              Checkout
            </button>
          </div>
        </div>
      ) : null}

      {cart ? (
        <CartCheckoutSlider
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          cart={cart}
          onCartChange={persistCart}
        />
      ) : null}

      {user?.role === 'admin' ? (
        <p className="px-4 pb-6 text-xs text-stone-400">
          Admin: <Link to={vendorPath(vendor.id)} className="underline">/vendors/{vendor.id}</Link>
        </p>
      ) : null}
    </div>
  );
}
