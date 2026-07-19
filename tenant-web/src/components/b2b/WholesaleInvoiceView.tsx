'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveInvoiceDisplayStatus } from '@/lib/b2b/invoice-display';
import type {
  WholesaleInvoiceDisplayStatus,
  WholesaleInvoiceLineItem,
  WholesaleInvoiceReconcileResponse,
  WholesaleInvoiceResponse,
  WholesaleInvoiceRow,
} from '@/lib/b2b/types';

export type WholesaleInvoiceViewProps = {
  invoiceId: string;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function formatUsdFromCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function lineSku(item: WholesaleInvoiceLineItem): string {
  return item.productSkuId || item.PRODUCT_SKU_ID || 'UNKNOWN_SKU';
}

function lineQty(item: WholesaleInvoiceLineItem): number {
  return Number(item.quantity ?? item.QUANTITY ?? 0);
}

function lineUnit(item: WholesaleInvoiceLineItem): number {
  return Number(item.unitPriceCents ?? item.UNIT_PRICE_CENTS ?? 0);
}

function lineTotal(item: WholesaleInvoiceLineItem): number {
  return Number(item.lineTotalCents ?? item.LINE_TOTAL_CENTS ?? 0);
}

function badgeClass(status: WholesaleInvoiceDisplayStatus): string {
  if (status === 'PAID') {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  }
  if (status === 'OVERDUE') {
    return 'border-rose-400/40 bg-rose-500/15 text-rose-100';
  }
  return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
}

export function WholesaleInvoiceView({
  invoiceId,
  accessToken,
  apiBaseUrl = '',
}: WholesaleInvoiceViewProps) {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<WholesaleInvoiceRow | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [canReconcile, setCanReconcile] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setError('AUTHORIZATION_REQUIRED');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/vendors/orders/invoices/${encodeURIComponent(invoiceId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        },
      );
      const body = (await res.json()) as WholesaleInvoiceResponse;
      if (!res.ok) {
        throw new Error(body.error || `WHOLESALE_INVOICE_HTTP_${res.status}`);
      }
      if (!body.INVOICE) {
        throw new Error('WHOLESALE_INVOICE_ERROR: INVOICE_MISSING');
      }
      setInvoice(body.INVOICE);
      setViewerRole(body.VIEWER_ROLE ?? null);
      setCanReconcile(Boolean(body.CAN_RECONCILE));
      // eslint-disable-next-line no-console
      console.log(
        `WHOLESALE_INVOICE_LOADED ID=${body.INVOICE.ID} NUMBER=${body.INVOICE.INVOICE_NUMBER} ROLE=${body.VIEWER_ROLE ?? 'UNKNOWN'}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'WHOLESALE_INVOICE_LOAD_FAILED',
      );
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayStatus: WholesaleInvoiceDisplayStatus = useMemo(() => {
    if (!invoice) return 'PENDING';
    if (invoice.DISPLAY_STATUS === 'PAID' || invoice.DISPLAY_STATUS === 'OVERDUE' || invoice.DISPLAY_STATUS === 'PENDING') {
      return invoice.DISPLAY_STATUS;
    }
    return resolveInvoiceDisplayStatus(invoice.STATUS, invoice.DUE_AT);
  }, [invoice]);

  const onExport = () => {
    // eslint-disable-next-line no-console
    console.log(`WHOLESALE_INVOICE_EXPORT ID=${invoiceId} ACTION=PRINT_TO_PDF`);
    window.print();
  };

  const onMarkPaid = async () => {
    if (!accessToken || !invoice) return;
    setReconciling(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendors/invoices/reconcile`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          invoice_id: invoice.ID,
          paid_at: new Date().toISOString(),
        }),
        cache: 'no-store',
      });
      const body = (await res.json()) as WholesaleInvoiceReconcileResponse;
      if (!res.ok) {
        throw new Error(
          body.error || body.message || `WHOLESALE_RECONCILE_HTTP_${res.status}`,
        );
      }
      if (body.INVOICE) {
        setInvoice(body.INVOICE);
      } else {
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                STATUS: 'PAID',
                DISPLAY_STATUS: 'PAID',
                PAID_AT: new Date().toISOString(),
              }
            : prev,
        );
      }
      setCanReconcile(false);
      setStatusMessage('INVOICE_MARKED_PAID');
      // eslint-disable-next-line no-console
      console.log(
        `INVOICE_MARKED_PAID ID=${body.INVOICE?.ID ?? invoice.ID} NUMBER=${body.INVOICE?.INVOICE_NUMBER ?? invoice.INVOICE_NUMBER}`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `LEDGER_RECONCILED INVOICE=${body.INVOICE?.ID ?? invoice.ID} LEDGER=${body.LEDGER ?? 'LEDGER_RECONCILED'}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'WHOLESALE_RECONCILE_FAILED',
      );
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <p className="font-mono text-xs uppercase tracking-widest text-white/50">
        LOADING_INVOICE
      </p>
    );
  }

  if (error && !invoice) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
        {error}
      </p>
    );
  }

  if (!invoice) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
        WHOLESALE_INVOICE_NOT_FOUND
      </p>
    );
  }

  const currency = invoice.CURRENCY || 'USD';
  const isSeller = viewerRole === 'SELLER';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 font-sans text-zinc-50">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 print:mb-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
            Wholesale Invoice
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {invoice.INVOICE_NUMBER}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${badgeClass(displayStatus)}`}
              data-testid="invoice-display-status"
            >
              {displayStatus}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/45">
              DB {invoice.STATUS} — {invoice.PAYMENT_TERMS}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex min-w-[10rem] items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-sky-500 print:hidden"
          data-testid="export-invoice"
        >
          EXPORT INVOICE
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className="mb-4 font-mono text-[11px] uppercase tracking-widest text-emerald-300/90"
          data-testid="invoice-reconcile-status"
        >
          {statusMessage}
        </p>
      ) : null}

      {isSeller && canReconcile ? (
        <div
          className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 print:hidden"
          data-testid="seller-reconcile-panel"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
            Accounts Receivable — Seller Actions
          </p>
          <p className="mt-2 text-xs text-white/65">
            Mark this Net-30 invoice paid after external funds clear. Current AR
            badge: {displayStatus}.
          </p>
          <button
            type="button"
            disabled={reconciling}
            onClick={() => {
              void onMarkPaid();
            }}
            className="mt-4 inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            data-testid="mark-invoice-paid"
          >
            {reconciling ? 'RECONCILING' : 'MARK AS PAID'}
          </button>
        </div>
      ) : null}

      <article
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 print:border-black print:bg-white print:text-black"
        data-testid={`invoice-${invoice.ID}`}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/45 print:text-neutral-500">
              Bill To (Buyer)
            </p>
            <p className="mt-1 text-sm font-semibold">
              {invoice.BUYER_BUSINESS_NAME || invoice.BUYER_VENDOR_ID}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-white/40 print:text-neutral-500">
              {invoice.BUYER_VENDOR_ID}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/45 print:text-neutral-500">
              Remit To (Seller)
            </p>
            <p className="mt-1 text-sm font-semibold">
              {invoice.SELLER_BUSINESS_NAME || invoice.SELLER_VENDOR_ID}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-white/40 print:text-neutral-500">
              {invoice.SELLER_VENDOR_ID}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 font-mono text-[11px] uppercase tracking-wide text-white/70 sm:grid-cols-2 print:text-neutral-700">
          <div>
            <dt className="text-white/40 print:text-neutral-500">Issued At</dt>
            <dd className="mt-1">{invoice.ISSUED_AT}</dd>
          </div>
          <div>
            <dt className="text-white/40 print:text-neutral-500">Due At (Net-30)</dt>
            <dd className="mt-1">{invoice.DUE_AT}</dd>
          </div>
          <div>
            <dt className="text-white/40 print:text-neutral-500">Order</dt>
            <dd className="mt-1">{invoice.ORDER_ID}</dd>
          </div>
          <div>
            <dt className="text-white/40 print:text-neutral-500">Paid At</dt>
            <dd className="mt-1">{invoice.PAID_AT || '—'}</dd>
          </div>
        </dl>

        <table className="mt-8 w-full border-collapse text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-widest text-white/45 print:text-neutral-500">
            <tr className="border-b border-white/10 print:border-neutral-300">
              <th className="py-2 font-semibold">SKU</th>
              <th className="py-2 font-semibold">Qty</th>
              <th className="py-2 font-semibold">Unit</th>
              <th className="py-2 font-semibold">Line</th>
            </tr>
          </thead>
          <tbody>
            {invoice.LINE_ITEMS.map((item, index) => (
              <tr
                key={`${lineSku(item)}-${index}`}
                className="border-b border-white/8 print:border-neutral-200"
              >
                <td className="py-3 font-mono text-xs uppercase tracking-wide">
                  {lineSku(item)}
                </td>
                <td className="py-3 font-mono text-xs">{lineQty(item)}</td>
                <td className="py-3 font-mono text-xs">
                  {formatUsdFromCents(lineUnit(item), currency)}
                </td>
                <td className="py-3 font-mono text-xs font-semibold">
                  {formatUsdFromCents(lineTotal(item), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4 print:border-neutral-300">
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/45 print:text-neutral-500">
            Amount Due
          </p>
          <p className="text-2xl font-extrabold tracking-tight">
            {formatUsdFromCents(invoice.TOTAL_CENTS, currency)}
          </p>
        </div>
      </article>
    </section>
  );
}
