import { Link } from 'react-router-dom';

import { OrdersListSkeleton } from '@/components/orders/OrdersListSkeleton';
import { useAuth } from '@/hooks/use-auth';
import { useFulfillmentOrders } from '@/hooks/use-fulfillment-orders';
import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import type { FulfillmentOrderRow } from '@/hooks/use-fulfillment-orders';
import '@/components/ui/ui.css';

function itemSummary(items: FulfillmentOrderRow['order_items']): string {
  if (items.length === 0) return 'No items';
  const preview = items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.product?.name ?? item.item_title ?? 'Item'}`)
    .join(', ');
  return items.length > 2 ? `${preview} +${items.length - 2} more` : preview;
}

function FulfillmentOrderRowCard({
  order,
  mode,
  onFulfill,
  fulfilling,
}: {
  order: FulfillmentOrderRow;
  mode: 'pending' | 'fulfilled';
  onFulfill?: (orderId: string) => void;
  fulfilling?: boolean;
}) {
  const shopperLabel =
    order.shopper?.user?.name?.trim() ||
    order.shopper?.user?.email?.trim() ||
    `Order ${order.pickup_code ?? order.id.slice(0, 8)}`;

  return (
    <article className="app-card" style={{ minHeight: 108 }}>
      <div className="app-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="app-row-title">{shopperLabel}</p>
          <p className="app-row-meta">{itemSummary(order.order_items)}</p>
          <p className="app-row-meta" style={{ marginTop: '0.25rem' }}>
            {formatPrice(order.total)} · {formatDateTime(order.created_at)}
          </p>
          {order.event ? (
            <p className="app-row-meta" style={{ marginTop: '0.25rem' }}>
              {order.event.name}
            </p>
          ) : null}
        </div>
        <span className="app-status">
          {ORDER_STATUS_LABEL[order.order_status] ?? order.order_status.replace(/_/g, ' ')}
        </span>
      </div>

      {mode === 'pending' && onFulfill ? (
        <div className="app-row" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
          <button
            type="button"
            className="app-btn app-btn--primary"
            style={{ flex: 1 }}
            disabled={fulfilling}
            onClick={() => onFulfill(order.id)}
          >
            {fulfilling ? 'Marking fulfilled…' : 'Mark fulfilled'}
          </button>
          <Link to={`/vendor/orders/${order.id}`} className="app-btn app-btn--secondary">
            Details
          </Link>
        </div>
      ) : (
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>
          Collected {formatDateTime(order.updated_at)}
        </p>
      )}
    </article>
  );
}

export function VendorFulfillmentPage() {
  const { vendor } = useAuth();
  const {
    markets,
    selectedMarketId,
    setSelectedMarketId,
    pendingOrders,
    fulfilledOrders,
    counts,
    loading,
    error,
    fulfillingIds,
    fulfillOrder,
  } = useFulfillmentOrders(vendor?.id);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Live operations</p>
      <h1 className="app-title">Fulfillment</h1>
      <p className="app-subtitle">Day-of pickup ledger for your market booths.</p>

      <div className="app-dashboard-grid" style={{ marginBottom: '1rem' }}>
        <div className="app-card" style={{ minHeight: 88 }}>
          <p className="app-title" style={{ fontSize: '1.75rem', margin: 0 }}>
            {counts.pending}
          </p>
          <p className="app-row-meta">Pending pickup</p>
        </div>
        <div className="app-card app-card--honeydew" style={{ minHeight: 88 }}>
          <p className="app-title" style={{ fontSize: '1.75rem', margin: 0 }}>
            {counts.fulfilled}
          </p>
          <p className="app-row-meta">Fulfilled today</p>
        </div>
      </div>

      <label className="app-card" style={{ display: 'block', marginBottom: '1rem' }}>
        <span className="app-row-meta">Market session</span>
        <select
          className="app-input"
          style={{ marginTop: '0.35rem', width: '100%' }}
          value={selectedMarketId}
          onChange={(event) =>
            setSelectedMarketId(event.target.value === 'all' ? 'all' : event.target.value)
          }
        >
          <option value="all">All active markets</option>
          {markets.map((market) => (
            <option key={market.id} value={market.id}>
              {market.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <div className="app-empty" style={{ marginBottom: '1rem' }}>{error}</div> : null}

      {loading ? (
        <OrdersListSkeleton count={4} />
      ) : (
        <>
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Pending pickup</h2>
          {pendingOrders.length === 0 ? (
            <div className="app-card app-card--honeydew" style={{ minHeight: 72, marginBottom: '1.5rem' }}>
              <p className="app-row-meta">No shoppers waiting — counters stay at zero until new orders arrive.</p>
            </div>
          ) : (
            <div className="app-list" style={{ marginBottom: '1.5rem' }}>
              {pendingOrders.map((order) => (
                <FulfillmentOrderRowCard
                  key={order.id}
                  order={order}
                  mode="pending"
                  fulfilling={fulfillingIds.has(order.id)}
                  onFulfill={fulfillOrder}
                />
              ))}
            </div>
          )}

          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Fulfilled</h2>
          {fulfilledOrders.length === 0 ? (
            <div className="app-card" style={{ minHeight: 72 }}>
              <p className="app-row-meta">Fulfilled orders will archive here after you mark pickup complete.</p>
            </div>
          ) : (
            <div className="app-list">
              {fulfilledOrders.map((order) => (
                <FulfillmentOrderRowCard key={order.id} order={order} mode="fulfilled" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
