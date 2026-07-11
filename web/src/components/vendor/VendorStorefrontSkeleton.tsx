import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

export function VendorStorefrontSkeleton() {
  return (
    <div className="app-screen flex flex-col gap-4 pb-24">
      <Skeleton className="h-40 w-full rounded-2xl md:h-48" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonText width="55%" height={22} />
          <SkeletonText width="35%" height={14} />
        </div>
      </div>
      <SkeletonText width="90%" height={14} />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} height={100} />
        ))}
      </div>
    </div>
  );
}
