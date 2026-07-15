import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Map + sidebar list placeholders — avoids layout shift while events load. */
export function MapListSkeleton() {
  return (
    <div className="shopper-map-layout" aria-busy aria-label="Loading map">
      <div className="relative z-0 min-w-0">
        <Skeleton className="events-map-frame h-[50vh] min-h-[240px] w-full rounded-2xl md:h-[60vh] md:min-h-[360px]" />
      </div>
      <div className="shopper-map-list flex w-full flex-col gap-4 px-4 md:px-0">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="w-full rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
            <SkeletonText width="65%" height={18} />
            <SkeletonText width="45%" height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}
