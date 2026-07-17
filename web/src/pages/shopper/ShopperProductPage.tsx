import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { useAuth } from '@/hooks/use-auth';
import { useNow } from '@/hooks/use-now';
import { formatEventDisplayDate, formatPrice } from '@/lib/format';
import { vendorPath } from '@/lib/market-routes';
import {
  createPreorderPickup,
  type PreorderPaymentMethod,
} from '@/lib/preorders';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  media_urls: string[];
  reserve_enabled: boolean;
  stock: number | null;
  vendor_id: string;
  vendor: { business_name: string | null; user_id: string } | null;
};

type AvailabilityRow = {
  id: string;
  available_quantity_presale: number;
  event: {
    id: string;
    name: string;
    start_datetime: string;
    end_datetime?: string | null;
    timezone?: string | null;
    hours_summary?: string | null;
    sync_metadata?: Record<string, unknown>;
    state?: string | null;
  } | null;
};

type FulfillmentChoice =
  | { kind: 'storefront' }
  | { kind: 'event'; eventId: string; label: string };

export function ShopperProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const now = useNow(60_000);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState<FulfillmentChoice>({ kind: 'storefront' });
  const [paymentMethod, setPaymentMethod] =
    useState<PreorderPaymentMethod>('PAY_AT_HANDOFF');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [productRes, availRes] = await Promise.all([
        supabase
          .from('products')
          .select(
            'id, name, description, price, media_urls, reserve_enabled, stock, vendor_id, vendor:vendors(business_name, user_id)',
          )
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('product_event_availability')
          .select(
            'id, available_quantity_presale, event:events(id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, state)',
          )
          .eq('product_id', id)
          .gt('available_quantity_presale', 0),
      ]);
      setProduct(productRes.data as unknown as ProductRow | null);
      setAvailability((availRes.data as unknown as AvailabilityRow[]) ?? []);
      setLoading(false);
    }
    void load();
  }, [id]);

  const upcomingEvents = useMemo(
    () =>
      availability.filter(
        (row) =>
          row.event &&
          new Date(row.event.end_datetime ?? row.event.start_datetime).getTime() >=
            now.getTime(),
      ),
    [availability, now],
  );

  const maxQty = useMemo(() => {
    const stock = product?.stock ?? 0;
    if (fulfillment.kind === 'event') {
      const row = availability.find((a) => a.event?.id === fulfillment.eventId);
      const eventQty = row?.available_quantity_presale ?? 0;
      return Math.max(1, Math.min(stock || eventQty, eventQty || stock || 1));
    }
    return Math.max(1, stock || 1);
  }, [availability, fulfillment, product?.stock]);

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!product?.vendor?.user_id) {
      setError('Vendor profile is missing.');
      return;
    }
    if (!user) {
      setError('Sign in as a shopper to place a pre-order.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const label =
        fulfillment.kind === 'storefront'
          ? 'PICKUP AT STOREFRONT'
          : fulfillment.label;
      const order = await createPreorderPickup({
        vendorUserId: product.vendor.user_id,
        productId: product.id,
        quantity,
        paymentMethod,
        eventId: fulfillment.kind === 'event' ? fulfillment.eventId : null,
        fulfillmentLabel: label,
      });
      setSuccessCode(order.pickup_code);
      setProduct((prev) =>
        prev
          ? { ...prev, stock: Math.max(0, (prev.stock ?? 0) - quantity) }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place pre-order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }
  if (!product) return <div className="app-empty">Product not found.</div>;

  const canPreorder =
    product.reserve_enabled &&
    ((product.stock ?? 0) > 0 || upcomingEvents.length > 0);

  return (
    <div className="app-screen">
      <Link to={vendorPath(product.vendor_id)} className="app-back-link">
        ← {product.vendor?.business_name ?? 'Vendor'}
      </Link>

      <FallbackImage
        src={product.media_urls[0]}
        variant="product"
        style={{
          width: '100%',
          borderRadius: '16px',
          marginBottom: '1rem',
          minHeight: '180px',
          maxHeight: '320px',
          objectFit: 'cover',
        }}
      />

      <p className="app-eyebrow">PRE-ORDER</p>
      <h1 className="app-title">{product.name}</h1>
      <p className="app-subtitle">{formatPrice(product.price)}</p>
      {product.description ? <p>{product.description}</p> : null}

      {upcomingEvents.length > 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            UPCOMING EVENTS / MARKETS
          </h2>
          <div className="app-list">
            {upcomingEvents.map((row) => (
              <div key={row.id} className="app-card">
                <p className="app-row-title">{row.event?.name}</p>
                <p className="app-row-meta">
                  {row.event ? formatEventDisplayDate(row.event, now) : ''} ·{' '}
                  {row.available_quantity_presale} available
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canPreorder ? (
        <button
          type="button"
          className="app-btn app-btn--primary"
          style={{ marginTop: '1.5rem' }}
          onClick={() => {
            setDrawerOpen(true);
            setSuccessCode(null);
            setError(null);
          }}
        >
          [ RESERVE ]
        </button>
      ) : (
        <p className="app-empty" style={{ marginTop: '1.5rem' }}>
          Pre-order is not available for this item right now.
        </p>
      )}

      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm pre-order"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(9, 9, 11, 0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !submitting && setDrawerOpen(false)}
        >
          <form
            onSubmit={(e) => void onConfirm(e)}
            onClick={(e) => e.stopPropagation()}
            className="app-card"
            style={{
              width: 'min(480px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              marginBottom: 0,
            }}
          >
            <p className="app-eyebrow" style={{ margin: 0 }}>
              PRE-ORDER
            </p>
            <h2 className="app-title" style={{ fontSize: '1.35rem', marginTop: '0.35rem' }}>
              {product.name}
            </h2>

            {successCode ? (
              <div style={{ marginTop: '1rem' }}>
                <p className="app-row-meta">PENDING PICKUP</p>
                <p className="app-row-title" style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                  {successCode}
                </p>
                <p className="app-row-meta">
                  Show this code at hand-off. Payment:{' '}
                  {paymentMethod === 'STRIPE_ONLINE' ? 'PAID' : 'PAY AT PICKUP'}.
                </p>
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  style={{ marginTop: '1rem' }}
                  onClick={() => setDrawerOpen(false)}
                >
                  DONE
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginTop: '1rem' }}>
                  <p className="app-row-meta">FULFILLMENT LOCATION</p>
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <label className="app-card" style={{ margin: 0, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="fulfillment"
                        checked={fulfillment.kind === 'storefront'}
                        onChange={() => setFulfillment({ kind: 'storefront' })}
                      />{' '}
                      PICKUP AT STOREFRONT
                    </label>
                    {upcomingEvents.map((row) => {
                      if (!row.event) return null;
                      const label = `UPCOMING EVENT · ${row.event.name}`.toUpperCase();
                      return (
                        <label
                          key={row.event.id}
                          className="app-card"
                          style={{ margin: 0, cursor: 'pointer' }}
                        >
                          <input
                            type="radio"
                            name="fulfillment"
                            checked={
                              fulfillment.kind === 'event' &&
                              fulfillment.eventId === row.event!.id
                            }
                            onChange={() =>
                              setFulfillment({
                                kind: 'event',
                                eventId: row.event!.id,
                                label,
                              })
                            }
                          />{' '}
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <p className="app-row-meta">PAYMENT</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className={`app-btn app-btn--small${paymentMethod === 'STRIPE_ONLINE' ? ' app-btn--primary' : ' app-btn--secondary'}`}
                      onClick={() => setPaymentMethod('STRIPE_ONLINE')}
                    >
                      PAY NOW (CARD)
                    </button>
                    <button
                      type="button"
                      className={`app-btn app-btn--small${paymentMethod === 'PAY_AT_HANDOFF' ? ' app-btn--primary' : ' app-btn--secondary'}`}
                      onClick={() => setPaymentMethod('PAY_AT_HANDOFF')}
                    >
                      PAY AT PICKUP
                    </button>
                  </div>
                  <p className="app-row-meta" style={{ marginTop: '0.35rem' }}>
                    {paymentMethod === 'PAY_AT_HANDOFF'
                      ? 'Cash, Venmo, or SNAP/EBT at hand-off.'
                      : 'Card payment recorded as PAID for this pre-order.'}
                  </p>
                </div>

                <div className="app-input-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="preorder-qty">QUANTITY</label>
                  <input
                    id="preorder-qty"
                    className="app-input"
                    type="number"
                    min={1}
                    max={maxQty}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))
                    }
                  />
                </div>

                <p className="app-row-meta">
                  TOTAL · {formatPrice(product.price * quantity)}
                </p>

                {error ? <p className="app-error">{error}</p> : null}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="app-btn app-btn--secondary"
                    disabled={submitting}
                    onClick={() => setDrawerOpen(false)}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="app-btn app-btn--primary"
                    style={{ flex: 1 }}
                    disabled={submitting}
                  >
                    {submitting ? 'CONFIRMING…' : '[ CONFIRM PRE-ORDER ]'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}

      <ReviewsSection targetType="product" targetId={product.id} />
    </div>
  );
}
