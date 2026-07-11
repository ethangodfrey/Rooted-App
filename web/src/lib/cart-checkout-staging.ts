import { createCheckout, type CheckoutLineInput } from '@/lib/checkout-api';
import { validateCartInventory } from '@/lib/cart-inventory';
import type { PresaleCart } from '@/lib/presale-cart';
import { supabase } from '@/lib/supabase';

export interface StagedVendorOrder {
  vendorId: string;
  vendorName: string;
  eventId: string;
  eventName: string;
  lines: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;
  subtotal: number;
}

export interface StagedCheckoutPreview {
  marketId: string;
  marketName: string;
  marketCity: string | null;
  marketState: string | null;
  marketAddress: string | null;
  vendorOrders: StagedVendorOrder[];
  inventoryValid: boolean;
  inventoryIssues: Array<{ productId: string; productName?: string; error: string }>;
}

/** Load market + vendor participation context before submitting checkout. */
export async function stageCheckoutPreview(cart: PresaleCart): Promise<StagedCheckoutPreview> {
  const inventory = await validateCartInventory(
    cart.marketId,
    cart.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      name: line.name,
    })),
  );

  const [eventRes, vendorEventsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, city, state, address')
      .eq('id', cart.marketId)
      .maybeSingle(),
    supabase
      .from('vendor_events')
      .select('vendor_id, participation_status')
      .eq('event_id', cart.marketId)
      .eq('participation_status', 'approved'),
  ]);

  const approvedVendorIds = new Set(
    (vendorEventsRes.data ?? []).map((row) => row.vendor_id as string),
  );

  const vendorMap = new Map<string, StagedVendorOrder>();
  for (const line of cart.lines) {
    if (!approvedVendorIds.has(line.vendorId)) continue;

    const current = vendorMap.get(line.vendorId);
    const stagedLine = {
      productId: line.productId,
      name: line.name,
      quantity: line.quantity,
      price: line.price,
      lineTotal: line.price * line.quantity,
    };

    if (current) {
      current.lines.push(stagedLine);
      current.subtotal += stagedLine.lineTotal;
    } else {
      vendorMap.set(line.vendorId, {
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        eventId: cart.marketId,
        eventName: eventRes.data?.name ?? cart.marketName,
        lines: [stagedLine],
        subtotal: stagedLine.lineTotal,
      });
    }
  }

  return {
    marketId: cart.marketId,
    marketName: eventRes.data?.name ?? cart.marketName,
    marketCity: eventRes.data?.city ?? cart.marketCity,
    marketState: eventRes.data?.state ?? cart.marketState,
    marketAddress: eventRes.data?.address ?? cart.marketAddress,
    vendorOrders: [...vendorMap.values()],
    inventoryValid: inventory.valid,
    inventoryIssues: inventory.issues,
  };
}

export function buildCheckoutPayload(cart: PresaleCart, notes?: string): CheckoutLineInput[] {
  return cart.lines.map((line) => ({
    productId: line.productId,
    eventId: cart.marketId,
    quantity: line.quantity,
    notes: notes?.trim() || undefined,
  }));
}

/** Submit staged multi-vendor presale cart through the NestJS checkout API. */
export async function submitStagedCheckout(cart: PresaleCart, notes?: string) {
  const preview = await stageCheckoutPreview(cart);
  if (!preview.inventoryValid) {
    const first = preview.inventoryIssues[0];
    throw new Error(first?.error ?? 'Inventory validation failed');
  }
  if (preview.vendorOrders.length === 0) {
    throw new Error('No approved vendors in this market session.');
  }

  return createCheckout(buildCheckoutPayload(cart, notes));
}
