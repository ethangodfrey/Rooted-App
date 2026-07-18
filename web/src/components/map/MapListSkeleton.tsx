import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/** Map + sidebar list loading placeholders — avoids layout shift on mobile. */
export function MapListSkeleton() {
  return (
    <div className="shopper-map-layout" aria-busy aria-label="Loading map">
      <Skeleton className="events-map-frame h-[min(52vh,400px)] w-full min-h-[280px] md:min-h-[360px] md:h-[min(68vh,520px)]" />
      <div className="shopper-map-list flex w-full flex-col gap-3 px-4 md:max-h-[min(68vh,520px)] md:overflow-y-auto md:px-0">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} height={72} />
        ))}
      </div>
    </div>
  );
}
