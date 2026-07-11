import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Fixed-height settlement cards — prevents layout shift while totals load. */
export function SettlementSkeleton() {
  return (
    <section aria-busy aria-label="Loading settlement totals">
      <div className="grid min-h-[280px] grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <SkeletonText width="50%" height={12} />
            <Skeleton className="mt-3 h-9 w-28 rounded-lg" />
            <SkeletonText width="70%" height={12} />
          </div>
        ))}
        <div className="col-span-full min-h-[72px] rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:col-span-3">
          <SkeletonText width="35%" height={14} />
          <SkeletonText width="60%" height={12} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={`chart-${index}`}
            className="min-h-[240px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <SkeletonText width="45%" height={14} />
            <SkeletonText width="65%" height={12} />
            <div className="mt-6 flex h-[160px] items-end gap-2">
              {Array.from({ length: 7 }, (_, barIndex) => (
                <Skeleton
                  key={barIndex}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${40 + (barIndex % 3) * 24}px` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
