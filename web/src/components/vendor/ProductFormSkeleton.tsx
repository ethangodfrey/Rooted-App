import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Loading placeholder for product create/edit form fields. */
export function ProductFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading product form">
      <div className="flex flex-wrap gap-3">
        <Skeleton style={{ width: 80, height: 80, borderRadius: 12 }} />
        <Skeleton style={{ width: 80, height: 80, borderRadius: 12 }} />
      </div>
      <SkeletonText width="30%" height={14} />
      <Skeleton style={{ height: 44, width: '100%' }} />
      <SkeletonText width="40%" height={14} />
      <Skeleton style={{ height: 88, width: '100%' }} />
      <SkeletonText width="25%" height={14} />
      <Skeleton style={{ height: 44, width: '100%' }} />
      <Skeleton style={{ height: 48, width: '100%', marginTop: 8 }} />
    </div>
  );
}
