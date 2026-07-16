import type { CSSProperties } from 'react';

import type { UserRole } from '@/types/database';

export type StickerRole = 'shopper' | 'vendor';

type UserStickerProps = {
  role: UserRole | StickerRole | null | undefined;
  className?: string;
  style?: CSSProperties;
};

/** Map DB / legacy roles onto sticker badges. */
export function resolveStickerRole(
  role: UserRole | StickerRole | null | undefined,
): StickerRole | null {
  if (role === 'vendor') return 'vendor';
  if (role === 'shopper' || role === 'customer') return 'shopper';
  return null;
}

const STYLES: Record<StickerRole, CSSProperties> = {
  shopper: {
    color: '#c7d2fe',
    background: 'rgba(99, 102, 241, 0.16)',
    borderColor: 'rgba(129, 140, 248, 0.45)',
  },
  vendor: {
    color: '#fdba74',
    background: 'rgba(249, 115, 22, 0.16)',
    borderColor: 'rgba(251, 146, 60, 0.5)',
  },
};

/**
 * Minimalist role sticker — uppercase text only, no emojis.
 * SHOPPER (indigo) · VENDOR (amber/orange)
 */
export function UserSticker({ role, className, style }: UserStickerProps) {
  const sticker = resolveStickerRole(role);
  if (!sticker) return null;

  const label = sticker === 'vendor' ? 'VENDOR' : 'SHOPPER';
  const tone = STYLES[sticker];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: tone.borderColor,
        background: tone.background,
        color: tone.color,
        fontSize: '0.625rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1.2,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        ...style,
      }}
      aria-label={`${label} role`}
    >
      {label}
    </span>
  );
}
