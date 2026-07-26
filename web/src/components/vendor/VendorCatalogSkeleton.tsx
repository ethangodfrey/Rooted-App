import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Skeleton rows for vendor product catalog lists. */
export function VendorCatalogSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-3.5">
          <Skeleton style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <SkeletonText width="55%" height={16} />
            <SkeletonText width="35%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
