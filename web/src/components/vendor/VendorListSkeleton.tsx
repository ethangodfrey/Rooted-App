import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

interface VendorListSkeletonProps {
  rows?: number;
  rowHeight?: number;
}

/** Vendor dashboard list placeholders — pulse animation avoids layout shift on mobile. */
export function VendorListSkeleton({ rows = 4, rowHeight = 72 }: VendorListSkeletonProps) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonCard key={index} height={rowHeight} />
      ))}
      <SkeletonText width="40%" height={12} />
    </div>
  );
}

export function VendorCatalogSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading products">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border border-stone-200/60 bg-white/80 p-3.5">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonText width="60%" height={16} />
            <SkeletonText width="35%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
