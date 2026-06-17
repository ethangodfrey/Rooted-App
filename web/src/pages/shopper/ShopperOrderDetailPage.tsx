import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<{
    id: string;
    order_status: string;
    fulfillment_type: string | null;
    total: number;
    created_at: string;
    notes: string | null;
    vendor: { business_name: string | null } | null;
    event: { name: string; start_datetime: string } | null;
    leftover_listing: {
      title: string;
      pickup_address: string | null;
      pickup_city: string | null;
      pickup_state: string | null;
      pickup_notes: string | null;
      expires_at: string;
    } | null;
    order_items: { quantity: number; item_price: number; item_title: string | null; product: { name: string } | null }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('id, order_status, fulfillment_type, total, created_at, notes, vendor:vendors(business_name), event:events(name, start_datetime), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes, expires_at), order_items(quantity, item_price, item_title, product:products(name))')
        .eq('id', id)
        .maybeSingle();
      setOrder(data as unknown as typeof order);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!order) return <div className="app-empty">Order not found.</div>;

  return (
    <div className="app-screen">
      <Link to="/shopper/orders" className="app-back-link">← Orders</Link>
      <h1 className="app-title">Reservation</h1>
      <span className="app-status">{order.order_status.replace(/_/g, ' ')}</span>

      <div className="app-card" style={{ marginTop: '1rem' }}>
        <p className="app-row-meta">Vendor</p>
        <p className="app-row-title">{order.vendor?.business_name}</p>
        {order.event ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>Pickup event</p>
            <p>{order.event.name}</p>
          </>
        ) : order.leftover_listing ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>Leftover pickup</p>
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
        <p className="app-row-meta" style={{ marginTop: '1rem' }}>Placed</p>
        <p>{formatDateTime(order.created_at)}</p>
        {order.notes ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '1rem' }}>Notes</p>
            <p>{order.notes}</p>
          </>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.75rem' }}>Items</h2>
      <div className="app-list">
        {order.order_items.map((item, i) => (
          <div key={i} className="app-card app-row" style={{ justifyContent: 'space-between' }}>
            <span>{item.product?.name ?? item.item_title ?? 'Item'} × {item.quantity}</span>
            <span>{formatPrice(item.item_price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="app-card app-card--honeydew" style={{ marginTop: '1rem' }}>
        <p className="app-row-title">Total: {formatPrice(order.total)}</p>
      </div>
    </div>
  );
}
