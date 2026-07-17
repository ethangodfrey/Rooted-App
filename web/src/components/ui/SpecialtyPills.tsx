import type { CSSProperties } from 'react';

import { SpecialtyPill } from '@/components/ui/SpecialtyPill';

type SpecialtyPillsProps = {
  specialties: readonly string[] | null | undefined;
  className?: string;
  style?: CSSProperties;
};

/** Renders a wrap row of SpecialtyPill tags. */
export function SpecialtyPills({ specialties, className, style }: SpecialtyPillsProps) {
  const tags = (specialties ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tags.length === 0) return null;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        ...style,
      }}
    >
      {tags.map((tag) => (
        <SpecialtyPill key={tag} specialty={tag} />
      ))}
    </div>
  );
}
