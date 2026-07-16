import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PickupPass } from '@/components/orders/PickupPass';
import { fetchCheckout, type CheckoutResult } from '@/lib/checkout-api';
import { formatDateTime, formatEventTimeRange, formatPrice } from '@/lib/format';
import '@/components/ui/ui.css';

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

  const marketByEventId = useMemo(() => {
    const map = new Map<string, { name: string; start_datetime: string }>();
    if (!result) return map;
    for (const order of result.orders) {
      map.set(order.eventId, {
        name: order.eventName,
        start_datetime: order.fulfillmentWindowStart,
      });
    }
    return map;
  }, [result]);

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
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">Checkout complete</p>
      <h1 className="app-title">Your pickup orders are ready</h1>
      <p className="app-subtitle">
        We split your basket into {result.orders.length} vendor receipt
        {result.orders.length === 1 ? '' : 's'} totaling {formatPrice(result.totalAmount)}.
      </p>

      <div className="app-list">
        {result.orders.map((order) => {
          const market = marketByEventId.get(order.eventId);
          return (
            <section key={order.id} className="app-card" style={{ minHeight: 320 }}>
              <div className="app-section-header-inline" style={{ alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <p className="app-row-meta">Vendor receipt</p>
                  <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.25rem' }}>
                    {order.vendorName ?? 'Vendor'}
                  </h2>
                  <p className="app-row-meta" style={{ marginTop: '0.35rem' }}>
                    {order.eventName} · {formatDateTime(order.fulfillmentWindowStart)}
                  </p>
                </div>
              </div>

              <PickupPass
                compact
                orderId={order.id}
                pickupCode={order.pickupCode}
                vendorName={order.vendorName}
                market={
                  market
                    ? { name: market.name, start_datetime: market.start_datetime }
                    : { name: order.eventName, start_datetime: order.fulfillmentWindowStart }
                }
                boothDetails={order.boothDetails}
                fulfillmentWindowStart={order.fulfillmentWindowStart}
                fulfillmentWindowEnd={order.fulfillmentWindowEnd}
              />

              <div className="app-card app-card--honeydew" style={{ margin: '1rem 0' }}>
                <p className="app-row-title">Pickup window</p>
                <p className="app-row-meta">
                  {formatEventTimeRange(order.fulfillmentWindowStart, order.fulfillmentWindowEnd)}
                </p>
              </div>

              <div className="app-list">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.productId}`} className="app-row" style={{ minHeight: 44 }}>
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

      <Link to="/orders" className="app-btn app-btn--primary" style={{ marginTop: '1rem' }}>
        View all orders
      </Link>
    </div>
  );
}
