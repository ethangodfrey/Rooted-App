import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

export function ProductDetailSkeleton() {
  return (
    <div className="app-screen flex flex-col gap-4" aria-busy aria-label="Loading product">
      <SkeletonText width="30%" height={14} />
      <Skeleton className="h-52 w-full rounded-2xl sm:h-64" />
      <SkeletonText width="25%" height={12} />
      <SkeletonText width="70%" height={28} />
      <SkeletonText width="20%" height={18} />
      <SkeletonCard height={100} />
      <Skeleton className="mt-2 h-12 w-full rounded-xl" />
    </div>
  );
}
