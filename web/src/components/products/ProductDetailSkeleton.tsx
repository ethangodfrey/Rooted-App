import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Loading placeholder for product detail — mirrors hero image + title block. */
export function ProductDetailSkeleton() {
  return (
    <div className="app-screen flex flex-col gap-3" aria-busy aria-label="Loading product">
      <Skeleton style={{ width: '42%', height: 16, borderRadius: 8 }} />
      <Skeleton className="h-[min(320px,45vw)] w-full min-h-[180px] rounded-2xl" />
      <SkeletonText width="28%" height={12} />
      <SkeletonText width="72%" height={28} />
      <SkeletonText width="22%" height={18} />
      <SkeletonText width="88%" height={14} />
      <Skeleton className="mt-4 h-12 w-full rounded-xl" />
    </div>
  );
}
