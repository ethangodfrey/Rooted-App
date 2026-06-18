import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface OrderDetail {
  id: string;
  order_status: string;
  payment_status: string;
  total: number;
  notes: string | null;
  created_at: string;
  vendor: { business_name: string | null } | null;
  event: { name: string } | null;
  order_items: {
    quantity: number;
    item_price: number;
    product: { name: string } | null;
  }[];
}

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(
        'id, order_status, payment_status, total, notes, created_at, vendor:vendors(business_name), event:events(name), order_items(quantity, item_price, product:products(name))',
      )
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Order not found.');
      setOrder(null);
    } else {
      setOrder(data as unknown as OrderDetail);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!order) return <div className="app-empty">{error ?? 'Not found'}</div>;

  return (
    <div className="app-screen">
      <Link to="/admin/orders" className="app-back-link">← Orders</Link>
      <h1 className="app-title">Order</h1>
      <p className="app-subtitle">{formatDateTime(order.created_at)}</p>

      <div className="app-card" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Status</p>
        <p className="app-row-title">{ORDER_STATUS_LABEL[order.order_status as keyof typeof ORDER_STATUS_LABEL] ?? order.order_status}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Payment</p>
        <p className="app-row-title" style={{ textTransform: 'capitalize' }}>{order.payment_status.replace(/_/g, ' ')}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Vendor</p>
        <p>{order.vendor?.business_name ?? '—'}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Event</p>
        <p>{order.event?.name ?? '—'}</p>
        {order.notes ? (
          <>
            <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Notes</p>
            <p>{order.notes}</p>
          </>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.125rem' }}>Items</h2>
      <div className="app-list">
        {(order.order_items ?? []).map((item, idx) => (
          <div key={idx} className="app-card app-row">
            <div className="app-row-body">
              <p className="app-row-title">{item.product?.name ?? 'Item'}</p>
              <p className="app-row-meta">Qty {item.quantity}</p>
            </div>
            <p className="app-row-title">{formatPrice(item.item_price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <p className="app-row-title" style={{ marginTop: '1rem' }}>Total: {formatPrice(order.total)}</p>
    </div>
  );
}
