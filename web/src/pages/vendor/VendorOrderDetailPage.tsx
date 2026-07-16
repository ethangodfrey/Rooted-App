import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const NEXT_STATUS: Record<string, string> = {
  /** Nest multi-vendor checkout starts here */
  pending: 'preparing',
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
    pickup_code: string | null;
    event: { name: string; start_datetime: string } | null;
    leftover_listing: {
      title: string;
      pickup_address: string | null;
      pickup_city: string | null;
      pickup_state: string | null;
      pickup_notes: string | null;
    } | null;
    order_items: { id: string; quantity: number; item_price: number; item_title: string | null; product: { name: string } | null }[];
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setOrder(null);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select('id, order_status, fulfillment_type, total, created_at, notes, pickup_code, event:events(name, start_datetime), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes), order_items(id, quantity, item_price, item_title, product:products(name))')
      .eq('id', id)
      .maybeSingle();
    setOrder(data as unknown as typeof order);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function advanceStatus() {
    if (!order) return;
    const next = NEXT_STATUS[order.order_status];
    if (!next) return;
    setUpdating(true);
    await supabase.from('orders').update({ order_status: next, updated_at: new Date().toISOString() }).eq('id', order.id).eq('vendor_id', vendor?.id);
    setUpdating(false);
    await load();
  }

  if (!order) return <div className="app-loading"><div className="app-spinner" /></div>;

  return (
    <VendorScreen>
      <Link to="/vendor/orders" className="app-back-link">← Orders</Link>
      <VendorHero
        eyebrow="Order"
        title="Order detail"
        pill={order.order_status.replace(/_/g, ' ')}
      />

      <VendorFormPanel className="mb-5">
        <p className="m-0 text-xs text-stone-500">Placed {formatDateTime(order.created_at)}</p>
        {order.pickup_code ? (
          <p className="m-0 mt-3">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-400">
              Pickup code
            </span>
            <span className="mt-1 inline-flex rounded-xl bg-orange-500/15 px-3 py-2 font-mono text-lg font-extrabold tracking-[0.18em] text-orange-600">
              {order.pickup_code}
            </span>
          </p>
        ) : null}
        {order.event ? (
          <p className="m-0 mt-2 text-sm text-stone-700">Pickup market date: {order.event.name}</p>
        ) : order.leftover_listing ? (
          <p className="m-0 mt-2 text-sm text-stone-700">
            Leftover pickup: {order.leftover_listing.pickup_address ??
              (order.leftover_listing.pickup_city && order.leftover_listing.pickup_state
                ? `${order.leftover_listing.pickup_city}, ${order.leftover_listing.pickup_state}`
                : order.leftover_listing.title)}
          </p>
        ) : null}
        {order.notes ? <p className="m-0 mt-2 text-sm text-stone-700">Notes: {order.notes}</p> : null}
      </VendorFormPanel>

      <VendorSection title="Items">
        <VendorListPanel>
          {order.order_items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-3.5">
              <span className="flex min-w-0 items-center gap-3">
                <IconBadge name="package" tone="emerald" />
                <span className="truncate text-sm font-semibold text-stone-800">
                  {item.product?.name ?? item.item_title ?? 'Item'} × {item.quantity}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-stone-600">
                {formatPrice(item.item_price * item.quantity)}
              </span>
            </div>
          ))}
        </VendorListPanel>
      </VendorSection>

      <VendorFormPanel className="mb-5">
        <p className="m-0 text-sm font-semibold text-stone-800">Total: {formatPrice(order.total)}</p>
      </VendorFormPanel>

      {NEXT_STATUS[order.order_status] ? (
        <VendorPrimaryButton disabled={updating} onClick={advanceStatus}>
          {updating ? 'Updating…' : `Mark as ${NEXT_STATUS[order.order_status].replace(/_/g, ' ')}`}
        </VendorPrimaryButton>
      ) : null}
    </VendorScreen>
  );
}
