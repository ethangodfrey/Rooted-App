import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { SpecialtyPills } from '@/components/ui/SpecialtyPills';
import { UserSticker } from '@/components/ui/UserSticker';
import { VendorProductMenu } from '@/components/vendor/VendorProductMenu';
import { VendorStorefrontSkeleton } from '@/components/vendor/VendorStorefrontSkeleton';
import '@/components/ui/user-sticker.css';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useNow } from '@/hooks/use-now';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { useVendorStorefront } from '@/hooks/use-vendor-storefront';
import { followVendor, isFollowingVendor, unfollowVendor } from '@/lib/follows';
import { formatEventDisplayDate } from '@/lib/format';
import { vendorPath } from '@/lib/market-routes';
import type { MenuProduct } from '@/lib/product-menu';
import type { PresaleCartMarket } from '@/lib/presale-cart';
import { supabase } from '@/lib/supabase';
import {
  parseThemeSettings,
  resolveAccentColor,
} from '@/lib/vendor-storefront';

export function ShopperVendorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const marketQueryId = searchParams.get('market');
  const now = useNow(60_000);
  const { user } = useAuth();
  const { isSaved, toggle, pending } = useSavedVendors();
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const { cart, addToCart, openDrawer, itemCount, inventoryError, clearInventoryError } = useCart();
  const { vendor, products, upcomingMarkets, distanceLabel, loading, error } =
    useVendorStorefront(id);

  const profileId = user?.id ?? null;
  const followedProfileId = vendor?.user_id ?? null;

  useEffect(() => {
    if (!profileId || !followedProfileId) {
      setFollowing(false);
      return;
    }
    void isFollowingVendor(profileId, followedProfileId)
      .then(setFollowing)
      .catch(() => setFollowing(false));
  }, [profileId, followedProfileId]);

  useEffect(() => {
    if (!vendor?.user_id) {
      setSpecialties([]);
      return;
    }
    void supabase
      .from('profiles')
      .select('role, vendor_specialties, farmer_specialties')
      .eq('id', vendor.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setSpecialties([]);
          return;
        }
        const list =
          data.role === 'farmer'
            ? ((data.farmer_specialties as string[] | null) ?? [])
            : ((data.vendor_specialties as string[] | null) ?? []);
        setSpecialties(list);
      });
  }, [vendor?.user_id]);

  const accent = useMemo(() => {
    if (!vendor) return '#228B22';
    const theme = parseThemeSettings(vendor.theme_settings);
    return resolveAccentColor(theme.accent_color);
  }, [vendor]);

  const bannerUrl = vendor?.banner_url ?? vendor?.logo_url ?? null;

  const activeMarket = useMemo((): PresaleCartMarket | null => {
    if (cart?.marketId) {
      const fromUpcoming = upcomingMarkets.find((m) => m.id === cart.marketId);
      if (fromUpcoming) return fromUpcoming;
      return {
        id: cart.marketId,
        name: cart.marketName,
        city: cart.marketCity,
        state: cart.marketState,
        address: cart.marketAddress,
        start_datetime: cart.pickupSchedule.start_datetime,
        end_datetime: cart.pickupSchedule.end_datetime,
        timezone: cart.pickupSchedule.timezone,
        hours_summary: cart.pickupSchedule.hours_summary,
        sync_metadata: cart.pickupSchedule.sync_metadata,
      };
    }

    if (marketQueryId) {
      const matched = upcomingMarkets.find((m) => m.id === marketQueryId);
      if (matched) return matched;
    }

    if (upcomingMarkets.length === 1) return upcomingMarkets[0];
    return null;
  }, [cart, marketQueryId, upcomingMarkets]);

  const handleAddToCart = useCallback(
    async (product: MenuProduct) => {
      if (!vendor || !id || !product.reserve_enabled) return;

      let market = activeMarket;
      if (!market && upcomingMarkets.length > 0) {
        market = upcomingMarkets[0];
      }
      if (!market) return;

      await addToCart({
        productId: product.id,
        vendorId: id,
        vendorName: vendor.business_name ?? 'Vendor',
        market,
        mediaUrl: product.media_urls?.[0] ?? null,
      });
    },
    [activeMarket, addToCart, id, upcomingMarkets, vendor],
  );

  if (loading) {
    return <VendorStorefrontSkeleton />;
  }

  if (error || !vendor || !id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? 'Vendor not found.'}</p>
        <Link to="/explore" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
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
          to="/explore"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          {itemCount > 0 ? (
            <button
              type="button"
              className="app-btn app-btn--secondary app-btn--small"
              onClick={() => openDrawer()}
            >
              Cart ({itemCount})
            </button>
          ) : null}
          {profileId && followedProfileId ? (
            <button
              type="button"
              className="app-btn app-btn--primary app-btn--small"
              disabled={followBusy}
              onClick={() => {
                void (async () => {
                  setFollowBusy(true);
                  try {
                    if (following) {
                      await unfollowVendor(profileId, followedProfileId);
                      setFollowing(false);
                    } else {
                      await followVendor(profileId, followedProfileId);
                      setFollowing(true);
                    }
                  } finally {
                    setFollowBusy(false);
                  }
                })();
              }}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          ) : null}
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            disabled={pending}
            onClick={() => toggle(id)}
          >
            {saved ? '♥ Saved' : '♡ Save vendor'}
          </button>
        </div>
      </div>

      <div
        className="relative h-36 w-full overflow-hidden sm:h-44"
        style={{
          background: bannerUrl
            ? `url(${bannerUrl}) center/cover no-repeat`
            : '#09090b',
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
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 px-4">
          {vendor.logo_url ? (
            <img
              src={vendor.logo_url}
              alt=""
              className="h-14 w-14 rounded-lg border border-white/20 object-cover sm:h-16 sm:w-16"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 text-lg font-bold text-white sm:h-16 sm:w-16"
              style={{ backgroundColor: accent || '#18181b' }}
            >
              {(vendor.business_name ?? 'V').charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1 text-white">
            <div className="user-sticker-row mb-1">
              <h1 className="m-0 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                {vendor.business_name}
              </h1>
              <UserSticker role="vendor" />
            </div>
            <SpecialtyPills specialties={specialties} style={{ marginTop: '0.35rem' }} />
            {vendor.category ? (
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                {vendor.category}
              </p>
            ) : null}
            <TrustBadges userId={vendor.user_id} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        {distanceLabel ? (
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 tabular-nums">
            {distanceLabel} away
          </p>
        ) : null}
        {activeMarket ? (
          <p className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
            Presale pickup: <strong>{activeMarket.name}</strong>
            {formatEventDisplayDate(activeMarket, now)
              ? ` · ${formatEventDisplayDate(activeMarket, now)}`
              : ''}
          </p>
        ) : upcomingMarkets.length > 1 ? (
          <p className="mb-3 rounded-xl border border-zinc-200/50 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
            Select a market from upcoming markets below before adding items to your cart.
          </p>
        ) : null}
        {inventoryError ? (
          <p className="mb-3 rounded-xl border border-rose-200/60 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
            {inventoryError}
            <button type="button" className="ml-2 underline" onClick={clearInventoryError}>
              Dismiss
            </button>
          </p>
        ) : null}
        {vendor.business_description ? (
          <p className="mb-4 text-sm leading-relaxed text-zinc-600">{vendor.business_description}</p>
        ) : null}
        {vendor.product_summary ? (
          <p className="mb-6 text-xs font-medium text-zinc-500">{vendor.product_summary}</p>
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
                    to={vendorPath(vendor.id, m.id)}
                    className={`block rounded-lg border px-3 py-2 text-sm transition ${
                      activeMarket?.id === m.id
                        ? 'border-emerald-400 bg-emerald-50/70'
                        : 'border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
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
          onAddToCart={(product) => void handleAddToCart(product)}
        />

        <ReviewsSection targetType="vendor" targetId={id} />
      </div>

      {user?.role === 'admin' ? (
        <p className="px-4 pb-6 text-xs text-stone-400">
          Admin: <Link to={vendorPath(vendor.id)} className="underline">/vendors/{vendor.id}</Link>
        </p>
      ) : null}
    </div>
  );
}
