import { useMemo } from 'react';

import { formatEventTimeRange } from '@/lib/format';
import { formatPickupLocation, formatPickupSummary, type PickupScheduleFields } from '@/lib/pickup-schedule';
import '@/components/ui/ui.css';

const PICKUP_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizePickupCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return PICKUP_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** High-contrast token for booth scanning — prefers 6-char pickup code, else chunked order id. */
export function securePickupToken(orderId: string, pickupCode: string | null | undefined): string {
  const normalized = normalizePickupCode(pickupCode);
  if (normalized) return normalized;
  return orderId.replace(/-/g, '').slice(0, 12).toUpperCase();
}

function codeHash(code: string, index: number): boolean {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i) + index * 17) % 9973;
  }
  return hash % 3 !== 0;
}

export function PickupCodeVector({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 9;
    return Array.from({ length: size * size }, (_, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      const finder =
        (row < 3 && col < 3) ||
        (row < 3 && col >= size - 3) ||
        (row >= size - 3 && col < 3);
      return finder || codeHash(code, index);
    });
  }, [code]);

  return (
    <div
      className="pickup-pass__code"
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 112 }}
    >
      <svg
        role="img"
        aria-label={`Pickup verification code ${code}`}
        viewBox="0 0 90 90"
        width="112"
        height="112"
        style={{ background: '#fff', border: '4px solid #111827', borderRadius: 12, flexShrink: 0 }}
      >
        {cells.map((filled, index) => {
          if (!filled) return null;
          const x = (index % 9) * 10;
          const y = Math.floor(index / 9) * 10;
          return <rect key={index} x={x + 1} y={y + 1} width="8" height="8" fill="#111827" />;
        })}
      </svg>
      <code
        style={{
          fontSize: '1.125rem',
          fontWeight: 800,
          letterSpacing: '0.14em',
          wordBreak: 'break-all',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {code}
      </code>
    </div>
  );
}

export interface PickupPassProps {
  orderId: string;
  pickupCode?: string | null;
  vendorName?: string | null;
  market?: PickupScheduleFields | null;
  boothDetails?: string | null;
  fulfillmentWindowStart?: string | null;
  fulfillmentWindowEnd?: string | null;
  compact?: boolean;
}

export function PickupPass({
  orderId,
  pickupCode,
  vendorName,
  market,
  boothDetails,
  fulfillmentWindowStart,
  fulfillmentWindowEnd,
  compact = false,
}: PickupPassProps) {
  const token = securePickupToken(orderId, pickupCode);
  const vendorLabel = vendorName?.trim() || 'the vendor';
  const marketName = market?.name?.trim() || 'your market';

  const dayOfInstruction = market
    ? `Bring this pass to ${vendorLabel}'s booth at ${marketName}. ${formatPickupSummary(market)}.`
    : `Bring this pass to ${vendorLabel}'s booth and show this code at pickup.`;

  const boothNote =
    boothDetails?.trim() ||
    (market ? `Find ${vendorLabel} at ${formatPickupLocation(market)}.` : null);

  return (
    <section
      className="app-card app-card--honeydew pickup-pass"
      style={{ marginTop: compact ? 0 : '1rem' }}
      aria-label="Pickup pass"
    >
      <p className="app-eyebrow" style={{ marginBottom: '0.35rem' }}>
        Pickup pass
      </p>
      <div
        className="pickup-pass__layout"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
          <p className="app-row-title" style={{ marginBottom: '0.35rem' }}>
            Show at the booth
          </p>
          <p className="app-row-meta" style={{ marginBottom: '0.5rem' }}>
            {dayOfInstruction}
          </p>
          {boothNote ? <p className="app-row-meta">{boothNote}</p> : null}
          {fulfillmentWindowStart ? (
            <p className="app-row-meta" style={{ marginTop: '0.5rem' }}>
              Window:{' '}
              {formatEventTimeRange(
                fulfillmentWindowStart,
                fulfillmentWindowEnd ?? fulfillmentWindowStart,
              )}
            </p>
          ) : null}
        </div>
        <PickupCodeVector code={token} />
      </div>
    </section>
  );
}
