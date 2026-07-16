import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/** Map + sidebar loading placeholder — mirrors ShopperMapPage layout without layout shift. */
export function MapListSkeleton() {
  return (
    <div
      className="shopper-map-layout flex w-full min-w-0 flex-col gap-4 md:grid md:grid-cols-[1.4fr_1fr] md:items-start md:gap-5"
      aria-busy
      aria-label="Loading map"
    >
      <Skeleton className="events-map-frame h-[min(45vh,320px)] w-full min-w-0 rounded-2xl md:h-[min(68vh,520px)] md:min-h-[360px]" />
      <div className="flex w-full min-w-0 flex-col gap-3 px-4 pb-32 md:max-h-[min(68vh,520px)] md:overflow-y-auto md:px-0 md:pb-0">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} height={88} />
        ))}
      </div>
    </div>
  );
}
