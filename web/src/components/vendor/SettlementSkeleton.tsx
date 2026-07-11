import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Fixed-height settlement cards — prevents layout shift while totals load. */
export function SettlementSkeleton() {
  return (
    <section
      className="grid min-h-[280px] grid-cols-1 gap-3 sm:grid-cols-3"
      aria-busy
      aria-label="Loading settlement totals"
    >
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
    </section>
  );
}
