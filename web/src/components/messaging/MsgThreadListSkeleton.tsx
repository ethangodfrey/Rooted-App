import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** Skeleton rows for messaging thread lists. */
export function MsgThreadListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="msg-thread-list" aria-busy aria-label="Loading threads">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <div className="msg-thread-btn pointer-events-none flex items-center gap-3">
            <Skeleton style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
            <div className="min-w-0 flex-1">
              <SkeletonText width="55%" height={14} />
              <SkeletonText width="80%" height={12} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
