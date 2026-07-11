import { api } from '@/lib/api';

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

export interface CheckoutResult {
  transactionId: string;
  totalAmount: number;
  status: string;
  orders: CheckoutReceipt[];
}

export function createCheckout(items: CheckoutLineInput[]): Promise<CheckoutResult> {
  return api.post<CheckoutResult>('/checkout', { items });
}

export function fetchCheckout(transactionId: string): Promise<CheckoutResult> {
  return api.get<CheckoutResult>(`/checkout/transactions/${transactionId}`);
}
