import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

export function MarketDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Skeleton className="h-48 w-full rounded-2xl md:h-56 lg:h-64" />
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
