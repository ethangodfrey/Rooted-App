import type { CSSProperties } from 'react';

import type { SpecialtyTag } from '@/lib/specialties';

type SpecialtyPillsProps = {
  specialties: readonly string[] | null | undefined;
  className?: string;
  style?: CSSProperties;
  /** denser chips for map / network cards */
  size?: 'sm' | 'md';
};

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#27272a',
  background: '#09090b',
  color: '#a1a1aa',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  borderRadius: 6,
  lineHeight: 1.2,
};

/**
 * Specialty sub-stickers — uppercase text pills only, no emojis.
 */
export function SpecialtyPills({
  specialties,
  className,
  style,
  size = 'sm',
}: SpecialtyPillsProps) {
  const tags = (specialties ?? [])
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean) as SpecialtyTag[];

  if (tags.length === 0) return null;

  const pad = size === 'sm' ? '0.125rem 0.5rem' : '0.2rem 0.6rem';
  const fontSize = size === 'sm' ? '0.625rem' : '0.6875rem';

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
        <span
          key={tag}
          style={{
            ...BASE,
            padding: pad,
            fontSize,
          }}
          aria-label={`Specialty ${tag}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
