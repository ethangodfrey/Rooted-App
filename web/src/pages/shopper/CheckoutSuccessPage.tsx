import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { fetchCheckout, type CheckoutResult } from '@/lib/checkout-api';
import { formatDateTime, formatEventTimeRange, formatPrice } from '@/lib/format';
import '@/components/ui/ui.css';

const PICKUP_CODE_PATTERN = /^[A-Z0-9]{6}$/;

function normalizePickupCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return PICKUP_CODE_PATTERN.test(normalized) ? normalized : null;
}

function codeHash(code: string, index: number): boolean {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i) + index * 17) % 9973;
  }
  return hash % 3 !== 0;
}

function PickupCodeVector({ code }: { code: string }) {
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
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        role="img"
        aria-label={`Pickup verification code ${code}`}
        viewBox="0 0 90 90"
        width="112"
        height="112"
        style={{ background: '#fff', border: '4px solid #111827', borderRadius: 12 }}
      >
        {cells.map((filled, index) => {
          if (!filled) return null;
          const x = (index % 9) * 10;
          const y = Math.floor(index / 9) * 10;
          return <rect key={index} x={x + 1} y={y + 1} width="8" height="8" fill="#111827" />;
        })}
      </svg>
      <code style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.18em' }}>{code}</code>
    </div>
  );
}

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const transactionId = params.get('transactionId');
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setError('Missing checkout transaction.');
      setLoading(false);
      return;
    }

    let active = true;
    fetchCheckout(transactionId)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load checkout.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [transactionId]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (error || !result) {
    return <div className="app-empty">{error ?? 'Checkout not found.'}</div>;
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Checkout complete</p>
      <h1 className="app-title">Your pickup orders are ready</h1>
      <p className="app-subtitle">
        We split your basket into {result.orders.length} vendor receipt
        {result.orders.length === 1 ? '' : 's'} totaling {formatPrice(result.totalAmount)}.
      </p>

      <div className="app-list">
        {result.orders.map((order) => {
          const pickupCode = normalizePickupCode(order.pickupCode);
          return (
            <section key={order.id} className="app-card">
              <div className="app-section-header-inline" style={{ alignItems: 'flex-start' }}>
                <div>
                  <p className="app-row-meta">Vendor receipt</p>
                  <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.25rem' }}>
                    {order.vendorName ?? 'Vendor'}
                  </h2>
                  <p className="app-row-meta" style={{ marginTop: '0.35rem' }}>
                    {order.eventName} · {formatDateTime(order.fulfillmentWindowStart)}
                  </p>
                </div>
                {pickupCode ? <PickupCodeVector code={pickupCode} /> : null}
              </div>

              <div className="app-card app-card--honeydew" style={{ margin: '1rem 0' }}>
                <p className="app-row-title">Pickup window</p>
                <p className="app-row-meta">
                  {formatEventTimeRange(order.fulfillmentWindowStart, order.fulfillmentWindowEnd)}
                </p>
                <p className="app-row-title" style={{ marginTop: '0.75rem' }}>
                  Stall pickup note
                </p>
                <p className="app-row-meta">
                  {order.boothDetails ??
                    'Ask the market info booth or show this code at the vendor stall.'}
                </p>
              </div>

              <div className="app-list">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.productId}`} className="app-row">
                    <div className="app-row-body">
                      <p className="app-row-title">{item.name}</p>
                      <p className="app-row-meta">
                        {item.quantity} × {formatPrice(item.itemPrice)}
                      </p>
                    </div>
                    <p className="app-row-title">{formatPrice(item.lineTotal)}</p>
                  </div>
                ))}
              </div>

              <p className="app-row-title" style={{ marginTop: '1rem' }}>
                Vendor subtotal: {formatPrice(order.subtotal)}
              </p>
            </section>
          );
        })}
      </div>

      <Link to="/shopper/orders" className="app-btn app-btn--primary" style={{ marginTop: '1rem' }}>
        View all orders
      </Link>
    </div>
  );
}
