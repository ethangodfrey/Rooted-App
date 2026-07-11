import { Link } from 'react-router-dom';

import { PickupPass } from '@/components/orders/PickupPass';
import { OrdersListSkeleton } from '@/components/orders/OrdersListSkeleton';
import { useAuth } from '@/hooks/use-auth';
import { useShopperOrders } from '@/hooks/use-shopper-orders';
import { formatDateTime, formatPrice } from '@/lib/format';
import { showPickupPass } from '@/lib/order-fulfillment';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import type { OrderStatus } from '@/types/database';
import '@/components/ui/ui.css';

const ORDERS_BASE = '/profile/orders';

export function ShopperOrdersPage() {
  const { shopper } = useAuth();
  const { orders, loading, error } = useShopperOrders(shopper?.id);

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/shopper/profile" className="app-back-link">
        ← Profile
      </Link>
      <h1 className="app-title">My reservations</h1>
      <p className="app-subtitle">Pickup passes for presale orders at your markets.</p>

      {loading ? (
        <OrdersListSkeleton count={3} />
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : orders.length === 0 ? (
        <div className="app-empty">No reservations yet.</div>
      ) : (
        <div className="app-list">
          {orders.map((order) => {
            const status = order.order_status as OrderStatus;
            const showPass = showPickupPass(status);

            return (
              <article key={order.id} className="app-card" style={{ minHeight: showPass ? 280 : 88 }}>
                <Link to={`${ORDERS_BASE}/${order.id}`} className="app-card--pressable" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div className="app-row" style={{ justifyContent: 'space-between' }}>
                    <p className="app-row-title">{order.vendor?.business_name ?? 'Order'}</p>
                    <span className="app-status">{ORDER_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="app-row-meta">
                    {formatPrice(order.total)} · {formatDateTime(order.created_at)}
                  </p>
                  {order.event ? (
                    <p className="app-row-meta" style={{ marginTop: '0.25rem' }}>
                      {order.event.name}
                    </p>
                  ) : null}
                </Link>

                {showPass ? (
                  <PickupPass
                    compact
                    orderId={order.id}
                    pickupCode={order.pickup_code}
                    vendorName={order.vendor?.business_name}
                    market={order.event}
                    fulfillmentWindowStart={order.fulfillment_window_start}
                    fulfillmentWindowEnd={order.fulfillment_window_end}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
