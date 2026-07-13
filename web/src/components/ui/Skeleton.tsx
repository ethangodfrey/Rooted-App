import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** Animated placeholder block — shimmer + subtle opacity pulse via ui.css. */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`app-skeleton animate-pulse rounded-xl ${className}`.trim()}
      style={style}
      aria-hidden
    />
  );
}

export function SkeletonText({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <Skeleton style={{ width, height, borderRadius: 8 }} />;
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return <Skeleton className="app-skeleton--card" style={{ height, width: '100%' }} />;
}
