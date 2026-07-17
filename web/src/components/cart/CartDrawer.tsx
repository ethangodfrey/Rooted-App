import './cart-drawer.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CartMarketConflictModal } from '@/components/cart/CartMarketConflictModal';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { useNow } from '@/hooks/use-now';
import { useCart } from '@/hooks/use-cart';
import { stageCheckoutPreview, submitStagedCheckout } from '@/lib/cart-checkout-staging';
import { isApiConfigured } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { pickupSummaryFromCart } from '@/lib/pickup-schedule';
import type { StagedCheckoutPreview } from '@/lib/cart-checkout-staging';
import {
  resolveCartPaymentPolicy,
  type PreorderPaymentPolicy,
} from '@/lib/stripe-connect';
import { supabase } from '@/lib/supabase';

function CartLineRow({
  name,
  price,
  quantity,
  maxQuantity,
  mediaUrl,
  onDecrement,
  onIncrement,
  onRemove,
}: {
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  mediaUrl?: string | null;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="cart-line">
      <FallbackImage
        src={mediaUrl}
        variant="product"
        label={name}
        className="cart-line__media"
        style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem' }}
      />
      <div className="cart-line__meta">
        <p className="cart-line__name">{name}</p>
        <p className="cart-line__price">
          {formatPrice(price)} · max {maxQuantity}
        </p>
      </div>
      <div className="cart-qty" aria-label={`Quantity for ${name}`}>
        <button type="button" onClick={onDecrement} aria-label="Decrease quantity">
          −
        </button>
        <span>{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={quantity >= maxQuantity}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

export function CartDrawer() {
  const now = useNow(60_000);
  const navigate = useNavigate();
  const {
    cart,
    totals,
    drawerOpen,
    drawerStage,
    marketConflict,
    inventoryError,
    closeDrawer,
    setDrawerStage,
    confirmMarketSwitch,
    cancelMarketSwitch,
    updateQuantity,
    removeLine,
    clearInventoryError,
  } = useCart();

  const [notes, setNotes] = useState('');
  const [staging, setStaging] = useState<StagedCheckoutPreview | null>(null);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<'pickup' | 'stripe'>('pickup');
  const [vendorPolicy, setVendorPolicy] = useState<PreorderPaymentPolicy>('pickup_or_stripe');
  const [stripeReady, setStripeReady] = useState(false);

  const vendorIds = useMemo(
    () => [...new Set((cart?.lines ?? []).map((line) => line.vendorId))],
    [cart?.lines],
  );

  useEffect(() => {
    if (!drawerOpen || vendorIds.length === 0) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('vendors')
        .select('id, preorder_payment_policy, stripe_charges_enabled, stripe_account_id')
        .in('id', vendorIds);
      if (!active) return;
      const policies = (data ?? []).map(
        (row) =>
          (row.preorder_payment_policy as PreorderPaymentPolicy | null) ?? 'pickup_or_stripe',
      );
      const policy = resolveCartPaymentPolicy(policies);
      setVendorPolicy(policy);
      const ready = (data ?? []).every(
        (row) => Boolean(row.stripe_account_id) && Boolean(row.stripe_charges_enabled),
      );
      setStripeReady(ready);
      if (policy === 'stripe_only' && ready) setPaymentChoice('stripe');
      else if (policy === 'pickup_only' || !ready) setPaymentChoice('pickup');
    })();
    return () => {
      active = false;
    };
  }, [drawerOpen, vendorIds]);

  useEffect(() => {
    if (!drawerOpen || drawerStage !== 'review' || !cart) {
      setStaging(null);
      return;
    }

    let active = true;
    setStagingLoading(true);
    setCheckoutError(null);

    void stageCheckoutPreview(cart)
      .then((preview) => {
        if (active) setStaging(preview);
      })
      .catch((err: unknown) => {
        if (active) {
          setCheckoutError(err instanceof Error ? err.message : 'Could not stage checkout.');
        }
      })
      .finally(() => {
        if (active) setStagingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cart, drawerOpen, drawerStage]);

  const handleSubmit = useCallback(
    async (paymentMethod: 'pickup' | 'stripe') => {
      if (!cart) return;
      if (!isApiConfigured) {
        setCheckoutError('Checkout API is not configured. Set VITE_API_URL to place presale orders.');
        return;
      }

      setSubmitting(true);
      setCheckoutError(null);
      try {
        const result = await submitStagedCheckout(cart, notes, paymentMethod);

        if (paymentMethod === 'stripe' && result.stripeSessions?.length) {
          const nextUrl = result.stripeSessions.find((session) => session.url)?.url;
          if (!nextUrl) {
            throw new Error('Stripe checkout could not be started for this order.');
          }
          closeDrawer();
          window.location.href = nextUrl;
          return;
        }

        closeDrawer();
        navigate(`/checkout/success?transactionId=${result.transactionId}`);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'Checkout failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [cart, closeDrawer, navigate, notes],
  );

  const pickupLabel = cart ? pickupSummaryFromCart(cart, now) : null;

  return (
    <>
      <CartMarketConflictModal
        open={Boolean(marketConflict)}
        currentMarketName={cart?.marketName ?? 'your current market'}
        nextMarketName={marketConflict?.market.name ?? 'the new market'}
        onConfirm={() => void confirmMarketSwitch()}
        onCancel={cancelMarketSwitch}
      />

      <div className={`cart-drawer${drawerOpen ? ' cart-drawer--open' : ''}`} aria-hidden={!drawerOpen}>
        <button
          type="button"
          className="cart-drawer__backdrop"
          aria-label="Close cart"
          onClick={closeDrawer}
        />

        <aside className="cart-drawer__panel" role="dialog" aria-label="Presale cart">
          <header className="cart-drawer__header">
            <div>
              <h2 className="cart-drawer__title">
                {drawerStage === 'review' ? 'Review order' : 'Presale cart'}
              </h2>
              {cart ? (
                <p className="cart-drawer__subtitle">
                  Market date slot · {cart.marketName}
                  {cart.marketCity ? ` · ${cart.marketCity}` : ''}
                </p>
              ) : null}
            </div>
            <button type="button" className="app-btn app-btn--ghost app-btn--small" onClick={closeDrawer}>
              Close
            </button>
          </header>

          <div className="cart-drawer__body">
            {!cart || cart.lines.length === 0 ? (
              <p className="app-row-meta">Your presale cart is empty. Browse vendors at a market to add items.</p>
            ) : (
              <>
                {pickupLabel ? (
                  <div className="cart-pickup-banner">
                    <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">
                      Pickup market date
                    </span>
                    <span className="mt-0.5 block">{pickupLabel}</span>
                    <span className="mt-1 block text-xs opacity-80">
                      You’ll get a 6-character pickup code after checkout to show at the booth.
                    </span>
                  </div>
                ) : null}

                {inventoryError ? (
                  <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {inventoryError}
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={clearInventoryError}
                    >
                      Dismiss
                    </button>
                  </p>
                ) : null}

                {drawerStage === 'cart' ? (
                  totals.vendorGroups.map((group) => (
                    <section key={group.vendorId} className="cart-vendor-group">
                      <h3 className="cart-vendor-group__title">{group.vendorName}</h3>
                      {group.lines.map((line) => (
                        <CartLineRow
                          key={line.productId}
                          name={line.name}
                          price={line.price}
                          quantity={line.quantity}
                          maxQuantity={line.maxQuantity}
                          mediaUrl={line.mediaUrl}
                          onDecrement={() => updateQuantity(line.productId, line.quantity - 1)}
                          onIncrement={() => updateQuantity(line.productId, line.quantity + 1)}
                          onRemove={() => removeLine(line.productId)}
                        />
                      ))}
                      <p className="mt-1 text-xs text-slate-500">
                        Vendor subtotal {formatPrice(group.subtotal)}
                      </p>
                    </section>
                  ))
                ) : (
                  <>
                    {stagingLoading ? (
                      <p className="app-row-meta">Staging order lines…</p>
                    ) : staging ? (
                      <>
                        {!staging.inventoryValid ? (
                          <p className="mb-3 rounded-xl border border-zinc-200/50 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                            Inventory changed — update quantities before checkout.
                            <ul className="mt-2 list-disc pl-5">
                              {staging.inventoryIssues.map((issue) => (
                                <li key={issue.productId}>
                                  {issue.productName ?? 'Item'}: {issue.error}
                                </li>
                              ))}
                            </ul>
                          </p>
                        ) : null}

                        {staging.vendorOrders.map((order) => (
                          <section key={order.vendorId} className="cart-vendor-group">
                            <h3 className="cart-vendor-group__title">{order.vendorName}</h3>
                            <ul className="m-0 list-none p-0">
                              {order.lines.map((line) => (
                                <li key={line.productId} className="text-sm text-slate-700">
                                  {line.quantity}× {line.name} — {formatPrice(line.lineTotal)}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}

                        <label className="mt-4 block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            Pickup notes (optional)
                          </span>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Allergies, booth preferences, etc."
                          />
                        </label>

                        {vendorPolicy === 'pickup_or_stripe' ||
                        (vendorPolicy === 'stripe_only' && !stripeReady) ? (
                          <div className="mt-4">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                              Payment method
                            </p>
                            <div
                              className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
                              role="group"
                              aria-label="Payment method"
                            >
                              <button
                                type="button"
                                className={`rounded-lg px-3 py-3 text-left text-sm font-bold transition ${
                                  paymentChoice === 'stripe'
                                    ? 'bg-white text-orange-600 shadow'
                                    : 'text-slate-600'
                                }`}
                                onClick={() => setPaymentChoice('stripe')}
                                disabled={!stripeReady}
                              >
                                <span className="block">💳 Pay Now (Card)</span>
                                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                                  Secure Stripe Checkout
                                </span>
                              </button>
                              <button
                                type="button"
                                className={`rounded-lg px-3 py-3 text-left text-sm font-bold transition ${
                                  paymentChoice === 'pickup'
                                    ? 'bg-white text-orange-600 shadow'
                                    : 'text-slate-600'
                                }`}
                                onClick={() => setPaymentChoice('pickup')}
                              >
                                <span className="block">🤝 Pay at Pickup</span>
                                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                                  Swipe card or use EBT at the booth terminal
                                </span>
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {paymentChoice === 'stripe' &&
                        (vendorPolicy === 'stripe_only' ||
                          vendorPolicy === 'pickup_or_stripe') ? (
                          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                            <p className="m-0 text-sm font-bold text-orange-800">
                              Card payment via Stripe Checkout
                            </p>
                            <p className="m-0 mt-1 text-xs font-medium text-orange-900/70">
                              You’ll confirm on Stripe’s secure page (card, Apple Pay, Google Pay).
                              No card details are stored in Vendorly.
                            </p>
                          </div>
                        ) : null}

                        {vendorPolicy === 'stripe_only' && !stripeReady ? (
                          <p className="mt-3 text-xs font-semibold text-amber-700">
                            A vendor requires card payment but isn’t Stripe-ready yet — pay at pickup
                            is available for this basket.
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>

          {cart && cart.lines.length > 0 ? (
            <footer className="cart-drawer__footer">
              <div className="cart-summary-row">
                <span>Items ({totals.itemCount})</span>
                <span>{formatPrice(totals.subtotal)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Estimated tax</span>
                <span>{formatPrice(totals.estimatedTax)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Platform fulfillment</span>
                <span>{formatPrice(totals.platformFee)}</span>
              </div>
              <div className="cart-summary-row cart-summary-row--total">
                <span>Total</span>
                <span>{formatPrice(totals.grandTotal)}</span>
              </div>

              {checkoutError ? (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</p>
              ) : null}

              {drawerStage === 'cart' ? (
                <button
                  type="button"
                  className="app-btn app-btn--primary mt-3 w-full"
                  onClick={() => setDrawerStage('review')}
                >
                  Review order
                </button>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="app-btn app-btn--secondary"
                    onClick={() => setDrawerStage('cart')}
                    disabled={submitting}
                  >
                    Back to cart
                  </button>
                  {(() => {
                    // Pay at Pickup → paymentMethod 'pickup': Nest checkout skips
                    // assertVendorsStripeReady / Stripe session creation and writes
                    // paid_at_pickup reservations with pickup codes.
                    const method: 'pickup' | 'stripe' =
                      vendorPolicy === 'stripe_only' && stripeReady
                        ? 'stripe'
                        : vendorPolicy === 'pickup_only'
                          ? 'pickup'
                          : paymentChoice === 'stripe' && stripeReady
                            ? 'stripe'
                            : 'pickup';
                    const label =
                      method === 'stripe'
                        ? submitting
                          ? 'Redirecting to Stripe…'
                          : 'Pay now with card'
                        : submitting
                          ? 'Confirming reservation…'
                          : 'Confirm Reservation';
                    return (
                      <button
                        type="button"
                        className="app-btn app-btn--primary"
                        disabled={
                          submitting ||
                          stagingLoading ||
                          !staging?.inventoryValid ||
                          !isApiConfigured
                        }
                        onClick={() => void handleSubmit(method)}
                      >
                        {label}
                      </button>
                    );
                  })()}
                </div>
              )}
            </footer>
          ) : null}
        </aside>
      </div>
    </>
  );
}
