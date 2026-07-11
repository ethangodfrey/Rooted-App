import { api } from '@/lib/api';

export type CheckoutPaymentMethod = 'pickup' | 'stripe';

export interface CheckoutLineInput {
  productId: string;
  eventId: string;
  quantity: number;
  notes?: string;
}

export interface CheckoutReceiptItem {
  productId: string;
  name: string;
  quantity: number;
  itemPrice: number;
  lineTotal: number;
}

export interface CheckoutReceipt {
  id: string;
  vendorId: string;
  vendorName: string | null;
  eventId: string;
  eventName: string;
  fulfillmentWindowStart: string;
  fulfillmentWindowEnd: string;
  pickupCode: string;
  boothDetails: string | null;
  subtotal: number;
  platformFee: number;
  total: number;
  items: CheckoutReceiptItem[];
}

export interface CheckoutStripeSession {
  orderId: string;
  vendorId: string;
  vendorName: string | null;
  sessionId: string;
  url: string | null;
}

export interface CheckoutResult {
  transactionId: string;
  totalAmount: number;
  status: string;
  paymentMethod: CheckoutPaymentMethod;
  orders: CheckoutReceipt[];
  stripeSessions?: CheckoutStripeSession[];
}

export interface CreateCheckoutOptions {
  paymentMethod?: CheckoutPaymentMethod;
  successUrl?: string;
  cancelUrl?: string;
}

export function createCheckout(
  items: CheckoutLineInput[],
  options: CreateCheckoutOptions = {},
): Promise<CheckoutResult> {
  return api.post<CheckoutResult>('/checkout', {
    items,
    paymentMethod: options.paymentMethod ?? 'pickup',
    successUrl: options.successUrl,
    cancelUrl: options.cancelUrl,
  });
}

export function fetchCheckout(transactionId: string): Promise<CheckoutResult> {
  return api.get<CheckoutResult>(`/checkout/transactions/${transactionId}`);
}
