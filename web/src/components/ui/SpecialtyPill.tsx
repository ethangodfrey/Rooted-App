import type { CSSProperties } from 'react';

import { specialtyLabel } from '@/lib/specialties';

type SpecialtyPillProps = {
  specialty: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Single specialty tag — text-only, uppercase human label, no emojis.
 * Spec: text-[10px] tracking-widest font-bold border border-zinc-800
 *       text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-md
 */
export function SpecialtyPill({ specialty, className, style }: SpecialtyPillProps) {
  const label = specialtyLabel(specialty);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.625rem',
        letterSpacing: '0.1em',
        fontWeight: 700,
        textTransform: 'uppercase',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#27272a',
        color: '#a1a1aa',
        background: 'rgba(9, 9, 11, 0.8)',
        padding: '0.25rem 0.625rem',
        borderRadius: 6,
        lineHeight: 1.2,
        ...style,
      }}
      aria-label={`Specialty ${label}`}
    >
      {label}
    </span>
  );
}
