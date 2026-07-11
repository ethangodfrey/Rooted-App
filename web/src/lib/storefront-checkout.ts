import { isApiUrlConfigured } from '@/lib/api-url';
import { supabase } from '@/lib/supabase';
import type { StorefrontCartLine } from '@/lib/storefront-cart';

export type CheckoutPaymentMethod = 'reserve' | 'stripe';

export interface CheckoutInitiateRequest {
  vendorId: string;
  eventId: string;
  items: Array<Pick<StorefrontCartLine, 'productId' | 'quantity' | 'holdId'>>;
  notes?: string;
  paymentMethod?: CheckoutPaymentMethod;
}

export interface CheckoutInitiateResponse {
  ok: boolean;
  orderId: string;
  subtotal: number | null;
  inventorySync: { queued: number; skipped: boolean; reason?: string };
  payment: {
    method: string;
    provider: string | null;
    checkoutUrl?: string;
  };
}

function checkoutApiUrl(): string {
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const explicitApi = import.meta.env.VITE_CHECKOUT_API_URL?.trim();
  if (explicitApi) return `${explicitApi.replace(/\/$/, '')}/api/checkout/initiate`;
  return `${appOrigin}/api/checkout/initiate`;
}

/** Reserve inventory holds for cart lines before checkout. */
export async function reserveCartLine(
  productId: string,
  eventId: string,
  quantity: number,
): Promise<{ holdId: string | null; error: string | null }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return { holdId: null, error: 'Sign in to reserve items' };

  const { data, error } = await supabase.rpc('reserve_inventory', {
    p_product_id: productId,
    p_event_id: eventId,
    p_customer_id: userId,
    p_quantity: quantity,
  });

  if (error) return { holdId: null, error: error.message };
  const result = data as { success?: boolean; hold_id?: string; error?: string };
  if (!result?.success) return { holdId: null, error: result?.error ?? 'Could not reserve inventory' };
  return { holdId: result.hold_id ?? null, error: null };
}

/**
 * Initiate storefront checkout via serverless API.
 * Validates dual-channel inventory, creates the order, and enqueues POS sync jobs.
 */
export async function initiateStorefrontCheckout(
  payload: CheckoutInitiateRequest,
): Promise<CheckoutInitiateResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sign in to checkout');

  const successUrl = `${window.location.origin}/shopper/orders`;
  const cancelUrl = window.location.href;

  const res = await fetch(checkoutApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      successUrl,
      cancelUrl,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as CheckoutInitiateResponse & {
    error?: string;
    issues?: unknown;
  };

  if (!res.ok) {
    const issueText = json.issues ? ` — ${JSON.stringify(json.issues)}` : '';
    throw new Error(json.error ? `${json.error}${issueText}` : `Checkout failed (${res.status})`);
  }

  return json;
}

export function isCheckoutApiAvailable(): boolean {
  return typeof window !== 'undefined' && (isApiUrlConfigured() || Boolean(import.meta.env.VITE_CHECKOUT_API_URL));
}
