import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';

/** Fixed-height placeholders to avoid layout shift on slow mobile networks. */
export function OrdersListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="app-list" aria-busy aria-label="Loading orders">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="app-card" style={{ minHeight: 88 }}>
          <div className="app-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <SkeletonText width="55%" height={18} />
            <SkeletonText width="22%" height={16} />
          </div>
          <SkeletonText width="40%" height={14} />
        </div>
      ))}
      <SkeletonCard height={160} />
    </div>
  );
}
