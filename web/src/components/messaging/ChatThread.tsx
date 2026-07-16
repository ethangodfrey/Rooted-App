import type { ReactNode } from 'react';

import { UserSticker, type StickerRole } from '@/components/ui/UserSticker';
import type { UserRole } from '@/types/database';
import '@/components/ui/user-sticker.css';

export type ChatThreadProps = {
  /** Display name for the counterparty (or thread title). */
  title: string;
  /** Role sticker for the named participant. */
  role?: UserRole | StickerRole | null;
  /** Optional subtitle under the header (e.g. order context). */
  subtitle?: string | null;
  /** Thread body — messages list, composer, etc. */
  children?: ReactNode;
  className?: string;
  emptyLabel?: string;
};

/**
 * Chat thread chrome with plain-text role sticker beside the participant name.
 * Messaging backend can mount message lists as children.
 */
export function ChatThread({
  title,
  role,
  subtitle,
  children,
  className,
  emptyLabel = 'No messages yet.',
}: ChatThreadProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: '#0B1228',
        color: '#e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(18, 26, 54, 0.85)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="user-sticker-row" style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h1>
          <UserSticker role={role} />
        </div>
      </header>

      {subtitle ? (
        <p
          style={{
            margin: 0,
            padding: '0.65rem 1.25rem',
            fontSize: '0.75rem',
            color: 'rgba(148, 163, 184, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {subtitle}
        </p>
      ) : null}

      <div style={{ flex: 1, padding: '1.25rem' }}>
        {children ?? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(148, 163, 184, 0.9)' }}>
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}
