import { supabase } from '@/lib/supabase';

export type PreorderStatus = 'PENDING_PICKUP' | 'COMPLETED' | 'CANCELLED';
export type PreorderPaymentMethod = 'STRIPE_ONLINE' | 'PAY_AT_HANDOFF';
export type PreorderPaymentStatus = 'PAID' | 'PENDING';

export type PreorderOrder = {
  id: string;
  shopper_id: string;
  vendor_id: string;
  event_id: string | null;
  status: PreorderStatus;
  payment_method: PreorderPaymentMethod;
  payment_status: PreorderPaymentStatus;
  total_amount: number;
  pickup_code: string;
  fulfillment_label: string;
  created_at: string;
  completed_at: string | null;
};

export type PreorderOrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: { name: string } | null;
};

export type PreorderOrderRow = PreorderOrder & {
  shopper?: { name: string | null; email: string | null } | null;
  event?: { id: string; name: string } | null;
  items: PreorderOrderItem[];
};

export type CreatePreorderInput = {
  vendorUserId: string;
  productId: string;
  quantity: number;
  paymentMethod: PreorderPaymentMethod;
  eventId?: string | null;
  fulfillmentLabel: string;
};

export async function createPreorderPickup(
  input: CreatePreorderInput,
): Promise<PreorderOrder> {
  const { data, error } = await supabase.rpc('create_preorder_pickup', {
    p_vendor_user_id: input.vendorUserId,
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_payment_method: input.paymentMethod,
    p_event_id: input.eventId ?? null,
    p_fulfillment_label: input.fulfillmentLabel,
  });

  if (error) throw new Error(error.message);
  return normalizeOrder(data as PreorderOrder);
}

export async function fetchVendorPreorders(
  vendorUserId: string,
): Promise<PreorderOrderRow[]> {
  const { data, error } = await supabase
    .from('preorder_orders')
    .select(
      'id, shopper_id, vendor_id, event_id, status, payment_method, payment_status, total_amount, pickup_code, fulfillment_label, created_at, completed_at, event:events(id, name)',
    )
    .eq('vendor_id', vendorUserId)
    .in('status', ['PENDING_PICKUP', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const orders = ((data ?? []) as Array<PreorderOrder & {
    event: { id: string; name: string } | { id: string; name: string }[] | null;
  }>).map((row) => {
    const eventRaw = row.event;
    const event = Array.isArray(eventRaw) ? eventRaw[0] ?? null : eventRaw;
    return { ...normalizeOrder(row), event, items: [] as PreorderOrderItem[], shopper: null };
  });

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const shopperIds = [...new Set(orders.map((o) => o.shopper_id))];

  const [{ data: items }, { data: users }] = await Promise.all([
    supabase
      .from('preorder_order_items')
      .select('id, order_id, product_id, quantity, unit_price, product:products(name)')
      .in('order_id', orderIds),
    supabase.from('users').select('id, name, email').in('id', shopperIds),
  ]);

  const itemsByOrder = new Map<string, PreorderOrderItem[]>();
  for (const item of items ?? []) {
    const row = item as PreorderOrderItem & {
      product: { name: string } | { name: string }[] | null;
    };
    const product = Array.isArray(row.product) ? row.product[0] ?? null : row.product;
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      quantity: row.quantity,
      unit_price: Number(row.unit_price),
      product,
    });
    itemsByOrder.set(row.order_id, list);
  }

  const userById = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      { name: (u.name as string | null) ?? null, email: (u.email as string | null) ?? null },
    ]),
  );

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    shopper: userById.get(order.shopper_id) ?? null,
  }));
}

export async function completePreorderHandoff(
  orderId: string,
  pickupCode: string,
): Promise<PreorderOrder> {
  const { data, error } = await supabase.rpc('complete_preorder_handoff', {
    p_order_id: orderId,
    p_pickup_code: pickupCode.trim().toUpperCase(),
  });

  if (error) throw new Error(error.message);
  return normalizeOrder(data as PreorderOrder);
}

function normalizeOrder(row: PreorderOrder): PreorderOrder {
  return {
    ...row,
    total_amount: Number(row.total_amount),
    fulfillment_label: row.fulfillment_label || 'PICKUP AT STOREFRONT',
  };
}
