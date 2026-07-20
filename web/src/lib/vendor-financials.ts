import { api } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/api-url';
import { supabase } from '@/lib/supabase';

export type VendorBalance = {
  STATUS: string;
  VENDOR_ID: string;
  AVAILABLE_CENTS: number;
  ESCROW_HELD_CENTS: number;
  LOYALTY_LIABILITY_CENTS: number;
  MICRO_FEE_CENTS: number;
};

export type FinancialTransactionItem = {
  id: string;
  amountCents: number;
  voucherCents: number;
  netAmountCents: number;
  status: string;
  transactionType: string;
  referenceId: string | null;
  createdAt: string;
};

export type FinancialTransactionsResponse = {
  STATUS: string;
  ITEMS: FinancialTransactionItem[];
  COUNT: number;
};

export type GeneratedInvoice = {
  STATUS: string;
  INVOICE_ID: string;
  SOURCE: string;
  SOURCE_ID: string;
  VENDOR_ID: string;
  VENDOR_NAME: string | null;
  COUNTERPARTY_NAME: string | null;
  ISSUED_AT: string;
  STATUS_LABEL: string;
  CURRENCY: string;
  LINES: Array<{
    label: string;
    quantity: number | null;
    unitCents: number | null;
    totalCents: number;
    kind: string;
  }>;
  SUBTOTAL_CENTS: number;
  LOYALTY_VOUCHER_CENTS: number;
  LOYALTY_POINTS_APPLIED: number;
  PLATFORM_FEE_CENTS: number;
  PLATFORM_FEE_BPS: number;
  TOTAL_CENTS: number;
  VENDOR_NET_CENTS: number;
};

export function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export async function fetchVendorBalance(
  vendorId: string,
): Promise<VendorBalance> {
  return api.get(`/api/financial/vendors/${vendorId}/balance`);
}

export async function fetchVendorTransactions(
  vendorId: string,
  limit = 40,
): Promise<FinancialTransactionsResponse> {
  return api.get(
    `/api/financial/vendors/${vendorId}/transactions?limit=${limit}`,
  );
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function openInvoiceHtml(path: string): Promise<void> {
  const API_URL = getApiBaseUrl();
  if (!API_URL) {
    throw new Error('Backend API is not configured. Set VITE_API_URL.');
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const html = await res.text();
  if (!res.ok) {
    throw new Error(`Invoice download failed (${res.status})`);
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadCateringInvoiceHtml(
  inquiryId: string,
): Promise<void> {
  await openInvoiceHtml(`/api/financial/invoices/catering/${inquiryId}/html`);
}

export async function downloadProcurementInvoiceHtml(
  requestId: string,
): Promise<void> {
  await openInvoiceHtml(
    `/api/financial/invoices/procurement/${requestId}/html`,
  );
}

export async function fetchCateringInvoice(
  inquiryId: string,
): Promise<{ STATUS: string; INVOICE: GeneratedInvoice }> {
  return api.get(`/api/financial/invoices/catering/${inquiryId}`);
}

export async function fetchProcurementInvoice(
  requestId: string,
): Promise<{ STATUS: string; INVOICE: GeneratedInvoice }> {
  return api.get(`/api/financial/invoices/procurement/${requestId}`);
}
