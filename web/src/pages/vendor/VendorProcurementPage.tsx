import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  PROCUREMENT_ITEM_CATEGORIES,
  fetchMyProcurementRequests,
  fetchWholesaleDirectory,
  formatProcurementStatusLabel,
  requestProcurementConnection,
  type ProcurementRequestItem,
  type WholesaleListingItem,
} from '@/lib/b2b-procurement';
import { downloadProcurementInvoiceHtml } from '@/lib/vendor-financials';
import '@/components/ui/ui.css';

export function VendorProcurementPage() {
  const { vendor } = useAuth();
  const [listings, setListings] = useState<WholesaleListingItem[]>([]);
  const [requests, setRequests] = useState<ProcurementRequestItem[]>([]);
  const [q, setQ] = useState('');
  const [location, setLocation] = useState(vendor?.postal_code?.trim() ?? '');
  const [category, setCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    console.log('PROCUREMENT_DASHBOARD_INITIALIZED SURFACE=VENDOR_B2B');
  }, []);

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dir, mine] = await Promise.all([
        fetchWholesaleDirectory({
          q,
          location,
          category,
          limit: 60,
        }),
        fetchMyProcurementRequests(),
      ]);
      setListings(dir.ITEMS ?? []);
      setRequests(mine.ITEMS ?? []);
      console.log(`WHOLESALE_UI_ACTIVE COUNT=${dir.COUNT ?? 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procurement dashboard');
    } finally {
      setLoading(false);
    }
  }, [q, location, category]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRequestConnection(item: WholesaleListingItem) {
    if (item.producerType !== 'FARMER') {
      setError('Request Connection is available for farmer suppliers.');
      return;
    }
    setRequestingId(item.id);
    setError(null);
    setFlash(null);
    try {
      await requestProcurementConnection({
        farmerId: item.producerId,
        listingId: item.id,
        message: `Bulk interest in ${item.itemName}`,
        requestedQuantity: item.minOrderQuantity,
      });
      setFlash(`REQUEST SENT FOR ${item.itemName.toUpperCase()}`);
      console.log('PROCUREMENT_DASHBOARD_INITIALIZED ACTION=REQUEST_SENT');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRequestingId(null);
    }
  }

  async function onDownloadInvoice(requestId: string) {
    setInvoiceBusyId(requestId);
    setError(null);
    try {
      await downloadProcurementInvoiceHtml(requestId);
      console.log(
        `INVOICING_ENGINE_INITIALIZED ACTION=DOWNLOAD_PROCUREMENT ID=${requestId.slice(0, 8)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invoice download failed');
    } finally {
      setInvoiceBusyId(null);
    }
  }

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="B2B marketplace"
        title="Procurement"
        subtitle="Search wholesale listings by location and category, then request a bulk connection with farmer suppliers."
        pill="WHOLESALE_UI_ACTIVE"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendor/network" className="app-btn app-btn--secondary app-btn--small">
          Business network
        </Link>
        <Link to="/vendor/financials" className="app-btn app-btn--secondary app-btn--small">
          Financials
        </Link>
      </div>

      <VendorSection title="Directory filters">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="app-eyebrow">Search</span>
            <input
              className="app-input mt-1 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Item or producer"
              aria-label="Search listings"
            />
          </label>
          <label className="block">
            <span className="app-eyebrow">Location</span>
            <input
              className="app-input mt-1 w-full"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, state, or ZIP"
              aria-label="Filter by location"
            />
          </label>
          <label className="block">
            <span className="app-eyebrow">Category</span>
            <select
              className="app-input mt-1 w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {PROCUREMENT_ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </VendorSection>

      {error ? <FieldError message={error} /> : null}
      {flash ? (
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-emerald-300">
          {flash}
        </p>
      ) : null}

      <VendorSection title="Wholesale listings">
        {loading ? (
          <p className="app-subtitle">Loading directory…</p>
        ) : listings.length === 0 ? (
          <p className="app-subtitle">
            No wholesale listings match these filters. Farmers must enable wholesale supplier
            status and publish listings.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {listings.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-lg font-bold text-zinc-50">{item.itemName}</p>
                    <p className="m-0 mt-1 text-sm text-white/70">
                      {item.producerName ?? 'Supplier'} · {item.producerType}
                    </p>
                    <p className="m-0 mt-1 font-mono text-[11px] uppercase tracking-wide text-orange-300/90">
                      {item.itemCategory}
                      {item.locationLabel ? ` · ${item.locationLabel}` : ''}
                      {` · ${item.availabilityStatus}`}
                    </p>
                    <p className="m-0 mt-2 text-sm text-white/80">
                      ${item.bulkUnitPrice.toFixed(2)} · MOQ {item.minOrderQuantity}
                    </p>
                  </div>
                  {item.producerType === 'FARMER' ? (
                    <VendorPrimaryButton
                      type="button"
                      disabled={requestingId === item.id}
                      onClick={() => void onRequestConnection(item)}
                    >
                      {requestingId === item.id ? 'Sending…' : 'Request Connection'}
                    </VendorPrimaryButton>
                  ) : (
                    <span className="font-mono text-[11px] uppercase text-white/50">
                      Vendor listing
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </VendorSection>

      <VendorSection title="My Requests">
        {requests.length === 0 ? (
          <p className="app-subtitle">
            No bulk connection requests yet. Use Request Connection on a farmer listing above.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {requests.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-zinc-50">
                    {row.itemName ?? 'Bulk connection'} · {row.farmName ?? 'Farm'}
                  </p>
                  <p className="m-0 mt-1 text-xs text-white/55">
                    {row.requestedQuantity != null
                      ? `Qty ${row.requestedQuantity} · `
                      : ''}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-orange-300">
                    {formatProcurementStatusLabel(row.status)}
                  </span>
                  {row.status === 'ACCEPTED' ? (
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--small"
                      disabled={invoiceBusyId === row.id}
                      onClick={() => void onDownloadInvoice(row.id)}
                    >
                      {invoiceBusyId === row.id
                        ? 'Opening…'
                        : 'Download Invoice'}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-white/40">
          Status updates from farmers appear here and in your notification center
          (PENDING | ACCEPTED | REJECTED).
        </p>
      </VendorSection>
    </VendorScreen>
  );
}
