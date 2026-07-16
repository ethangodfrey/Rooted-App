import { ExploreSwipeFeed } from '@/components/ExploreSwipeFeed';

export const dynamic = 'force-dynamic';

/**
 * Premium swipe-up shopper explore feed — `/shopper/explore`.
 * Optional query: `?lat=&lng=&radiusMiles=`
 */
export default async function ShopperExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lat = typeof params.lat === 'string' ? Number(params.lat) : NaN;
  const lng = typeof params.lng === 'string' ? Number(params.lng) : NaN;
  const radiusMiles =
    typeof params.radiusMiles === 'string' ? Number(params.radiusMiles) : undefined;
  const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim() || null;

  return (
    <main className="bg-[#0B1228]">
      <ExploreSwipeFeed
        initialLat={Number.isFinite(lat) ? lat : null}
        initialLng={Number.isFinite(lng) ? lng : null}
        initialRadiusMiles={
          radiusMiles != null && Number.isFinite(radiusMiles) ? radiusMiles : undefined
        }
        marketplaceUrl={marketplaceUrl}
      />
    </main>
  );
}
