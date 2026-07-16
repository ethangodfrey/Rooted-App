import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PickupPass } from '@/components/orders/PickupPass';
import { OrdersListSkeleton } from '@/components/orders/OrdersListSkeleton';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { ensureVendorThread } from '@/lib/messaging';
import { showPickupPass } from '@/lib/order-fulfillment';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/database';
import '@/components/ui/ui.css';

const ORDERS_BASE = '/profile/orders';

export function ShopperOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messaging, setMessaging] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    order_status: OrderStatus;
    payment_status: string;
    fulfillment_type: string | null;
    total: number;
    created_at: string;
    notes: string | null;
    pickup_code: string | null;
    fulfillment_window_start: string | null;
    fulfillment_window_end: string | null;
    vendor_id: string;
    vendor: { business_name: string | null } | null;
    event: {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      address: string | null;
      start_datetime: string;
      end_datetime: string | null;
      timezone: string | null;
      hours_summary: string | null;
      sync_metadata: Record<string, unknown> | null;
    } | null;
    leftover_listing: {
      title: string;
      pickup_address: string | null;
      pickup_city: string | null;
      pickup_state: string | null;
      pickup_notes: string | null;
      expires_at: string;
    } | null;
    order_items: {
      id: string;
      quantity: number;
      item_price: number;
      item_title: string | null;
      product: { name: string } | null;
    }[];
  } | null>(null);
  const [boothDetails, setBoothDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select(
          'id, order_status, payment_status, fulfillment_type, total, created_at, notes, pickup_code, fulfillment_window_start, fulfillment_window_end, vendor_id, event_id, vendor:vendors(business_name), event:events(id, name, city, state, address, start_datetime, end_datetime, timezone, hours_summary, sync_metadata), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes, expires_at), order_items(id, quantity, item_price, item_title, product:products(name))',
        )
        .eq('id', id)
        .maybeSingle();

      const row = data as unknown as (typeof order & { vendor_id: string; event_id: string | null }) | null;
      setOrder(row);

      if (row?.vendor_id && row.event_id) {
        const { data: participation } = await supabase
          .from('vendor_events')
          .select('booth_details')
          .eq('vendor_id', row.vendor_id)
          .eq('event_id', row.event_id)
          .maybeSingle();
        setBoothDetails((participation?.booth_details as string | null) ?? null);
      }

      setLoading(false);
    }
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="app-screen app-screen--narrow">
        <OrdersListSkeleton count={2} />
      </div>
    );
  }

  if (!order) return <div className="app-empty">Order not found.</div>;

  const showPass = showPickupPass(order.order_status);

  return (
    <div className="app-screen app-screen--narrow">
      <Link to={ORDERS_BASE} className="app-back-link">
        ← Orders
      </Link>
      <h1 className="app-title">Reservation</h1>
      <span className="app-status">
        {ORDER_STATUS_LABEL[order.order_status] ?? order.order_status.replace(/_/g, ' ')}
      </span>

      {showPass ? (
        <PickupPass
          orderId={order.id}
          pickupCode={order.pickup_code}
          vendorName={order.vendor?.business_name}
          market={order.event}
          boothDetails={boothDetails}
          fulfillmentWindowStart={order.fulfillment_window_start}
          fulfillmentWindowEnd={order.fulfillment_window_end}
        />
      ) : null}

      {user?.id && order.vendor_id ? (
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98] disabled:opacity-55"
          disabled={messaging}
          onClick={() => {
            void (async () => {
              setMessaging(true);
              try {
                const threadId = await ensureVendorThread({
                  customerUserId: user.id,
                  vendorId: order.vendor_id,
                  orderId: order.id,
                  subject: order.pickup_code ? `Order ${order.pickup_code}` : null,
                });
                navigate(`/shopper/messages?thread=${encodeURIComponent(threadId)}`);
              } finally {
                setMessaging(false);
              }
            })();
          }}
        >
          {messaging ? 'Opening chat…' : 'Message vendor'}
        </button>
      ) : null}

      <div className="app-card" style={{ marginTop: '1rem' }}>
        <p className="app-row-meta">Vendor</p>
        <p className="app-row-title">{order.vendor?.business_name}</p>
        {order.event ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>
              Pickup event
            </p>
            <p>{order.event.name}</p>
          </>
        ) : order.leftover_listing ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>
              Leftover pickup
            </p>
            <p>
              {order.leftover_listing.pickup_address ??
                (order.leftover_listing.pickup_city && order.leftover_listing.pickup_state
                  ? `${order.leftover_listing.pickup_city}, ${order.leftover_listing.pickup_state}`
                  : 'See vendor notes')}
            </p>
            {order.leftover_listing.pickup_notes ? (
              <p className="app-row-meta">{order.leftover_listing.pickup_notes}</p>
            ) : null}
          </>
        ) : null}
        <p className="app-row-meta" style={{ marginTop: '1rem' }}>
          Placed
        </p>
        <p>{formatDateTime(order.created_at)}</p>
        <p className="app-row-meta" style={{ marginTop: '1rem' }}>
          Payment
        </p>
        <p style={{ textTransform: 'capitalize' }}>{order.payment_status.replace(/_/g, ' ')}</p>
        {order.notes ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>
              Notes
            </p>
            <p>{order.notes}</p>
          </>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.75rem' }}>Items</h2>
      <div className="app-list">
        {order.order_items.map((item) => (
          <div key={item.id} className="app-card app-row" style={{ justifyContent: 'space-between', minHeight: 52 }}>
            <span>
              {item.product?.name ?? item.item_title ?? 'Item'} × {item.quantity}
            </span>
            <span>{formatPrice(item.item_price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="app-card app-card--honeydew" style={{ marginTop: '1rem', minHeight: 56 }}>
        <p className="app-row-title">Total: {formatPrice(order.total)}</p>
      </div>
    </div>
  );
}
