import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

export function MarketDetailSkeleton() {
  return (
    <div className="app-screen app-screen--narrow flex flex-col gap-4">
      <Skeleton className="h-48 w-full md:h-56" />
      <SkeletonText width="70%" height={28} />
      <SkeletonText width="45%" height={16} />
      <SkeletonCard height={140} />
      <SkeletonText width="40%" height={20} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonCard height={88} />
        <SkeletonCard height={88} />
        <SkeletonCard height={88} />
      </div>
    </div>
  );
}
