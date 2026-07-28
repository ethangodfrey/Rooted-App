import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  checkoutChefProcurement,
  confirmChefProcurementPickup,
  fetchChefProcurementCatalog,
  listChefProcurementOrders,
  type ChefProcurementCatalogItem,
} from '@/lib/chef-procurement';
import '@/components/ui/ui.css';

type CartQty = Record<string, number>;

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Private Chef / verified vendor wholesale procurement portal.
 * Enforces MOQ before Stripe Connect escrow checkout.
 */
export function ChefProcurementPage() {
  const { user, vendor } = useAuth();
  const [items, setItems] = useState<ChefProcurementCatalogItem[]>([]);
  const [qty, setQty] = useState<CartQty>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupOrderId, setPickupOrderId] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [orders, setOrders] = useState<
    Array<{ id: string; status: string; pickupCode: string; subtotalCents: number }>
  >([]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('CHEF_PROCUREMENT_INITIALIZED');
    // eslint-disable-next-line no-console
    console.log('B2B_WHOLESALE_ACTIVE');
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const catalog = await fetchChefProcurementCatalog({
          q: query || undefined,
          limit: 60,
        });
        if (!active) return;
        setItems(catalog.ITEMS);
        try {
          const mine = await listChefProcurementOrders();
          if (!active) return;
          setOrders(
            mine.ITEMS.map((row) => ({
              id: row.id,
              status: row.status,
              pickupCode: row.pickupCode,
              subtotalCents: row.subtotalCents,
            })),
          );
        } catch {
          if (active) setOrders([]);
        }
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load wholesale catalog');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const cartLines = useMemo(() => {
    return items
      .map((item) => {
        const quantity = Math.floor(Number(qty[item.id] ?? 0));
        if (!quantity) return null;
        return { item, quantity };
      })
      .filter((row): row is { item: ChefProcurementCatalogItem; quantity: number } => row != null);
  }, [items, qty]);

  const cartSellerIds = useMemo(
    () => [...new Set(cartLines.map((row) => row.item.vendorId))],
    [cartLines],
  );

  const moqViolations = cartLines.filter((row) => row.quantity < row.item.moqQuantity);
  const subtotalCents = cartLines.reduce(
    (sum, row) => sum + row.quantity * row.item.wholesalePriceCents,
    0,
  );
  const canCheckout =
    cartLines.length > 0 && moqViolations.length === 0 && cartSellerIds.length === 1 && !busy;

  async function onCheckout() {
    if (!canCheckout) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await checkoutChefProcurement({
        lines: cartLines.map((row) => ({
          productId: row.item.id,
          quantity: row.quantity,
        })),
        successUrl: `${window.location.origin}/chef/procurement?paid=1`,
        cancelUrl: `${window.location.origin}/chef/procurement?cancelled=1`,
      });
      setNotice(
        `ORDER ${result.ORDER_ID} · PICKUP_CODE ${result.PICKUP_CODE} · HELD_IN_ESCROW after payment`,
      );
      window.location.assign(result.CHECKOUT_URL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setBusy(false);
    }
  }

  async function onConfirmPickup() {
    if (!pickupOrderId.trim() || !pickupCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmChefProcurementPickup({
        orderId: pickupOrderId.trim(),
        pickupCode: pickupCode.trim(),
      });
      setNotice(`${result.STATUS} · ${result.ACTION} · ORDER=${result.ORDER_ID}`);
      setPickupCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup confirmation failed');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel =
    user?.role === 'chef' ? 'Private Chef' : vendor ? 'Verified Vendor' : 'Buyer';

  return (
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">B2B wholesale · Denver</p>
      <h1 className="app-title">Procurement</h1>
      <p className="app-subtitle">
        {roleLabel} bulk catalog — MOQ enforced, funds HELD_IN_ESCROW until pickup code verified.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/chef/dashboard" className="app-btn app-btn--ghost app-btn--small">
          Chef home
        </Link>
        <Link to="/vendor/procurement" className="app-btn app-btn--secondary app-btn--small">
          Vendor procurement
        </Link>
      </div>

      <div className="app-input-group mb-4">
        <label htmlFor="chef-procurement-q">Search suppliers / items</label>
        <input
          id="chef-procurement-q"
          className="app-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produce, dairy, farm name…"
        />
      </div>

      {error ? <div className="app-empty mb-4">{error}</div> : null}
      {notice ? (
        <div className="mb-4 rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 font-mono text-xs tracking-wide text-zinc-200">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="app-empty">
          No wholesale-eligible products yet. Farmers/vendors must enable wholesale on a product.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => {
            const quantity = qty[item.id] ?? 0;
            const belowMoq = quantity > 0 && quantity < item.moqQuantity;
            return (
              <li key={item.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="app-row-title" style={{ margin: 0 }}>
                      {item.name}
                    </p>
                    <p className="app-row-meta">
                      {item.vendorName ?? 'Supplier'}
                      {item.category ? ` · ${item.category}` : ''}
                      {item.locationLabel ? ` · ${item.locationLabel}` : ''}
                    </p>
                    <p className="app-row-meta font-mono tracking-wide">
                      WHOLESALE {formatUsd(item.wholesalePriceCents)} · MOQ {item.moqQuantity}
                      {item.retailPriceCents !== item.wholesalePriceCents
                        ? ` · RETAIL ${formatUsd(item.retailPriceCents)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      className="app-input"
                      style={{ width: '5.5rem' }}
                      type="number"
                      min={0}
                      step={1}
                      value={quantity || ''}
                      placeholder={`MOQ ${item.moqQuantity}`}
                      onChange={(e) => {
                        const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setQty((prev) => ({ ...prev, [item.id]: next }));
                      }}
                    />
                    {belowMoq ? (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                        MOQ_NOT_MET
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="app-title" style={{ fontSize: '1.25rem' }}>
          Bulk cart
        </h2>
        <p className="app-subtitle">
          One supplier per checkout. Subtotal {formatUsd(subtotalCents)}.
          {cartSellerIds.length > 1 ? ' Multiple suppliers — remove lines to continue.' : ''}
        </p>
        {moqViolations.length > 0 ? (
          <p className="app-row-meta font-mono text-amber-300">
            MOQ_NOT_MET on {moqViolations.length} line(s)
          </p>
        ) : null}
        <button
          type="button"
          className="app-btn app-btn--primary mt-3"
          disabled={!canCheckout}
          onClick={() => void onCheckout()}
        >
          {busy ? 'Starting escrow checkout…' : 'Checkout with escrow'}
        </button>
      </section>

      <section className="mt-10">
        <h2 className="app-title" style={{ fontSize: '1.25rem' }}>
          Confirm hand-off
        </h2>
        <p className="app-subtitle">
          Enter the order id and pickup code to release HELD_IN_ESCROW funds to the supplier.
        </p>
        <div className="app-input-group">
          <label htmlFor="pickup-order">Order id</label>
          <input
            id="pickup-order"
            className="app-input"
            value={pickupOrderId}
            onChange={(e) => setPickupOrderId(e.target.value)}
          />
        </div>
        <div className="app-input-group">
          <label htmlFor="pickup-code">Pickup code</label>
          <input
            id="pickup-code"
            className="app-input"
            value={pickupCode}
            onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
          />
        </div>
        <button
          type="button"
          className="app-btn app-btn--secondary"
          disabled={busy || !pickupOrderId.trim() || !pickupCode.trim()}
          onClick={() => void onConfirmPickup()}
        >
          Verify pickup & settle
        </button>

        {orders.length > 0 ? (
          <ul className="mt-4" style={{ listStyle: 'none', padding: 0 }}>
            {orders.map((order) => (
              <li key={order.id} className="app-row-meta font-mono mb-2">
                {order.id.slice(0, 8)}… · {order.status} · CODE {order.pickupCode} ·{' '}
                {formatUsd(order.subtotalCents)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
