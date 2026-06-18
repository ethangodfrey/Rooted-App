import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const NEXT_STATUS: Record<string, string> = {
  submitted: 'pending_review',
  pending_review: 'accepted',
  accepted: 'preparing',
  preparing: 'ready_for_pickup',
  ready_for_pickup: 'fulfilled',
};

export function VendorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { vendor } = useAuth();
  const [order, setOrder] = useState<{
    id: string;
    order_status: string;
    fulfillment_type: string | null;
    total: number;
    created_at: string;
    notes: string | null;
    event: { name: string; start_datetime: string } | null;
    leftover_listing: {
      title: string;
      pickup_address: string | null;
      pickup_city: string | null;
      pickup_state: string | null;
      pickup_notes: string | null;
    } | null;
    order_items: { quantity: number; item_price: number; item_title: string | null; product: { name: string } | null }[];
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('id, order_status, fulfillment_type, total, created_at, notes, event:events(name, start_datetime), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes), order_items(quantity, item_price, item_title, product:products(name))')
      .eq('id', id)
      .maybeSingle();
    setOrder(data as unknown as typeof order);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function advanceStatus() {
    if (!order) return;
    const next = NEXT_STATUS[order.order_status];
    if (!next) return;
    setUpdating(true);
    await supabase.from('orders').update({ order_status: next, updated_at: new Date().toISOString() }).eq('id', order.id).eq('vendor_id', vendor?.id);
    setUpdating(false);
    load();
  }

  if (!order) return <div className="app-loading"><div className="app-spinner" /></div>;

  return (
    <div className="app-screen">
      <Link to="/vendor/orders" className="app-back-link">← Orders</Link>
      <h1 className="app-title">Order detail</h1>
      <span className="app-status">{order.order_status.replace(/_/g, ' ')}</span>

      <div className="app-card" style={{ marginTop: '1rem' }}>
        <p className="app-row-meta">Placed {formatDateTime(order.created_at)}</p>
        {order.event ? (
          <p style={{ marginTop: '0.5rem' }}>Pickup event: {order.event.name}</p>
        ) : order.leftover_listing ? (
          <p style={{ marginTop: '0.5rem' }}>
            Leftover pickup: {order.leftover_listing.pickup_address ??
              (order.leftover_listing.pickup_city && order.leftover_listing.pickup_state
                ? `${order.leftover_listing.pickup_city}, ${order.leftover_listing.pickup_state}`
                : order.leftover_listing.title)}
          </p>
        ) : null}
        {order.notes ? <p style={{ marginTop: '0.5rem' }}>Notes: {order.notes}</p> : null}
      </div>

      <div className="app-list" style={{ marginTop: '1rem' }}>
        {(order.order_items ?? []).map((item, i) => (
          <div key={i} className="app-card app-row" style={{ justifyContent: 'space-between' }}>
            <span>{item.product?.name ?? item.item_title ?? 'Item'} × {item.quantity}</span>
            <span>{formatPrice(item.item_price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="app-card app-card--honeydew" style={{ marginTop: '1rem' }}>
        <p className="app-row-title">Total: {formatPrice(order.total)}</p>
      </div>

      {NEXT_STATUS[order.order_status] ? (
        <button type="button" className="app-btn app-btn--primary" style={{ marginTop: '1rem' }} disabled={updating} onClick={advanceStatus}>
          {updating ? 'Updating…' : `Mark as ${NEXT_STATUS[order.order_status].replace(/_/g, ' ')}`}
        </button>
      ) : null}
    </div>
  );
}
