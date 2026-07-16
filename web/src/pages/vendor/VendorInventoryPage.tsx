import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { ProductImage } from '@/components/ui/ProductImage';
import { HybridStockAllocator } from '@/components/vendor/hybrid-stock-allocator';
import {
  VendorEmpty,
  VendorHero,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatEventDisplayDate, formatPrice } from '@/lib/format';
import {
  allocateHybridStock,
  formatHybridStockLabel,
  percentFromQuantities,
} from '@/lib/hybrid-stock';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/database';
import '@/components/ui/ui.css';

const TACTILE_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 no-underline';

interface AttendedEvent {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown>;
  state?: string | null;
}

interface AvailabilityRow {
  product_id: string;
  event_id: string;
  available_quantity_presale: number;
  available_quantity_inperson: number;
}

interface DraftState {
  eventId: string;
  totalStock: number;
  preOrderPercent: number;
}

function parseAttendedEvents(
  rows: Array<{ events: AttendedEvent | AttendedEvent[] | null }> | null,
): AttendedEvent[] {
  return (rows ?? [])
    .map((row) => {
      const ev = row.events;
      return Array.isArray(ev) ? ev[0] : ev;
    })
    .filter((ev): ev is AttendedEvent => Boolean(ev))
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
}

function stockTotalsForProduct(
  productId: string,
  availability: AvailabilityRow[],
): { total: number; preOrder: number; walkUp: number } {
  let preOrder = 0;
  let walkUp = 0;
  for (const row of availability) {
    if (row.product_id !== productId) continue;
    preOrder += row.available_quantity_presale ?? 0;
    walkUp += row.available_quantity_inperson ?? 0;
  }
  return { total: preOrder + walkUp, preOrder, walkUp };
}

function draftFromAvailability(
  productId: string,
  eventId: string,
  availability: AvailabilityRow[],
): DraftState {
  const row = availability.find((r) => r.product_id === productId && r.event_id === eventId);
  const presale = row?.available_quantity_presale ?? 0;
  const inperson = row?.available_quantity_inperson ?? 0;
  const totalStock = presale + inperson;
  return {
    eventId,
    totalStock,
    preOrderPercent: percentFromQuantities(presale, inperson),
  };
}

export function VendorInventoryPage() {
  const { vendor } = useAuth();
  const [searchParams] = useSearchParams();
  const vendorIdParam = searchParams.get('vendorId')?.trim() ?? '';

  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<AttendedEvent[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const defaultEventId = useMemo(() => {
    if (events.length === 0) return '';
    const now = Date.now();
    const upcoming = events.find((ev) => new Date(ev.start_datetime).getTime() >= now);
    return (upcoming ?? events[events.length - 1]).id;
  }, [events]);

  const load = useCallback(async () => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setError(null);

    const [productsRes, participationRes] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_events')
        .select(
          'events!inner(id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, state)',
        )
        .eq('vendor_id', vendor.id),
    ]);

    if (productsRes.error) {
      setError(productsRes.error.message);
      setLoading(false);
      return;
    }

    const productRows = (productsRes.data ?? []) as Product[];
    const attended = parseAttendedEvents(
      participationRes.data as Array<{ events: AttendedEvent | AttendedEvent[] | null }> | null,
    );

    let availabilityRows: AvailabilityRow[] = [];
    if (productRows.length > 0) {
      const { data, error: availError } = await supabase
        .from('product_event_availability')
        .select('product_id, event_id, available_quantity_presale, available_quantity_inperson')
        .in(
          'product_id',
          productRows.map((p) => p.id),
        );
      if (availError) {
        setError(availError.message);
        setLoading(false);
        return;
      }
      availabilityRows = (data ?? []) as AvailabilityRow[];
    }

    setProducts(productRows);
    setEvents(attended);
    setAvailability(availabilityRows);
    setLoading(false);
  }, [vendor]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildDraft(productId: string): DraftState {
    const existing = drafts[productId];
    if (existing) return existing;
    const eventId = defaultEventId || events[0]?.id || '';
    return draftFromAvailability(productId, eventId, availability);
  }

  function openEditor(productId: string) {
    setSaveMessage(null);
    setError(null);
    if (expandedId === productId) {
      setExpandedId(null);
      return;
    }
    const draft = buildDraft(productId);
    setDrafts((prev) => ({ ...prev, [productId]: draft }));
    setExpandedId(productId);
  }

  function updateDraft(productId: string, patch: Partial<DraftState>) {
    setDrafts((prev) => {
      const base =
        prev[productId] ??
        draftFromAvailability(
          productId,
          defaultEventId || events[0]?.id || '',
          availability,
        );
      return { ...prev, [productId]: { ...base, ...patch } };
    });
  }

  async function handleSave(productId: string) {
    const draft = drafts[productId] ?? buildDraft(productId);
    if (!draft.eventId) {
      setError('Join a market event before allocating stock.');
      return;
    }
    if (!Number.isInteger(draft.totalStock) || draft.totalStock < 0) {
      setError('Total stock must be a whole number of 0 or more.');
      return;
    }

    const split = allocateHybridStock(draft.totalStock, draft.preOrderPercent);
    setSavingId(productId);
    setError(null);
    setSaveMessage(null);

    const { error: upError } = await supabase.from('product_event_availability').upsert(
      {
        product_id: productId,
        event_id: draft.eventId,
        available_quantity_presale: split.preOrder,
        available_quantity_inperson: split.walkUp,
      },
      { onConflict: 'product_id,event_id' },
    );

    setSavingId(null);

    if (upError) {
      setError(upError.message);
      return;
    }

    setAvailability((prev) => {
      const others = prev.filter(
        (r) => !(r.product_id === productId && r.event_id === draft.eventId),
      );
      return [
        ...others,
        {
          product_id: productId,
          event_id: draft.eventId,
          available_quantity_presale: split.preOrder,
          available_quantity_inperson: split.walkUp,
        },
      ];
    });
    setSaveMessage(`Saved ${formatHybridStockLabel(split)}`);
  }

  if (vendor?.id && !vendorIdParam) {
    return <Navigate to={`/vendor/inventory?vendorId=${encodeURIComponent(vendor.id)}`} replace />;
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Catalog"
        title="Inventory"
        subtitle="Allocate each batch between online pre-orders and in-person walk-ups so market day never starts empty."
        pill={`${products.length} product${products.length === 1 ? '' : 's'}`}
      />

      <Link to="/vendor/products/new" className={`${TACTILE_BTN} mb-6`}>
        Add Product
      </Link>

      {error ? <p className="app-error mb-4">{error}</p> : null}
      {saveMessage ? (
        <p className="mb-4 text-sm font-semibold text-orange-500" role="status">
          {saveMessage}
        </p>
      ) : null}

      {products.length === 0 ? (
        <VendorEmpty message="No products yet. Add your first listing to start allocating stock." />
      ) : (
        <VendorSection title="Product inventory">
          <ul className="inv-grid" role="list">
            {products.map((product) => {
              const totals = stockTotalsForProduct(product.id, availability);
              const isOpen = expandedId === product.id;
              const draft = isOpen ? (drafts[product.id] ?? buildDraft(product.id)) : null;
              const liveSplit = draft
                ? allocateHybridStock(draft.totalStock, draft.preOrderPercent)
                : null;

              return (
                <li key={product.id} className="inv-row">
                  <button
                    type="button"
                    className="inv-row__main"
                    onClick={() => openEditor(product.id)}
                    aria-expanded={isOpen}
                  >
                    <ProductImage
                      src={product.media_urls[0]}
                      category={product.category}
                      name={product.name}
                      size={64}
                      rounded="lg"
                    />
                    <span className="inv-row__meta">
                      <span className="inv-row__field-label">Name</span>
                      <span className="inv-row__name">{product.name}</span>
                      <span className="inv-row__field-label">Base Price</span>
                      <span className="inv-row__price">{formatPrice(product.price)}</span>
                    </span>
                    <span className="inv-row__stock">
                      <span className="inv-row__stock-label">Total Stock</span>
                      <span className="inv-row__stock-value">{totals.total}</span>
                      {totals.total > 0 ? (
                        <span className="inv-row__stock-split">
                          {percentFromQuantities(totals.preOrder, totals.walkUp)}% Pre-Order /{' '}
                          {100 - percentFromQuantities(totals.preOrder, totals.walkUp)}% Walk-Up
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {isOpen && draft ? (
                    <div className="inv-editor">
                      {events.length === 0 ? (
                        <p className="inv-editor__hint">
                          Join a market event to save hybrid allocation.{' '}
                          <Link to="/vendor/events" className="text-orange-400 underline">
                            Browse events
                          </Link>
                        </p>
                      ) : (
                        <>
                          <div className="inv-editor__field">
                            <label htmlFor={`event-${product.id}`}>Market event</label>
                            <select
                              id={`event-${product.id}`}
                              className="inv-input"
                              value={draft.eventId}
                              onChange={(e) => {
                                const eventId = e.target.value;
                                updateDraft(
                                  product.id,
                                  draftFromAvailability(product.id, eventId, availability),
                                );
                              }}
                            >
                              {events.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                  {ev.name} · {formatEventDisplayDate(ev)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="inv-editor__field">
                            <label htmlFor={`stock-${product.id}`}>Batch total (units)</label>
                            <input
                              id={`stock-${product.id}`}
                              className="inv-input inv-input--large"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              value={draft.totalStock}
                              onChange={(e) => {
                                const next = Number.parseInt(e.target.value || '0', 10);
                                updateDraft(product.id, {
                                  totalStock: Number.isFinite(next) ? Math.max(0, next) : 0,
                                });
                              }}
                            />
                          </div>

                          <HybridStockAllocator
                            id={`hybrid-${product.id}`}
                            totalStock={draft.totalStock}
                            preOrderPercent={draft.preOrderPercent}
                            onPreOrderPercentChange={(percent) =>
                              updateDraft(product.id, { preOrderPercent: percent })
                            }
                            disabled={savingId === product.id}
                          />

                          {liveSplit ? (
                            <p className="inv-editor__live">
                              Saving will write{' '}
                              <strong>
                                {liveSplit.preOrderPercent}% Pre-Order /{' '}
                                {100 - liveSplit.preOrderPercent}% Walk-Up
                              </strong>{' '}
                              ({formatHybridStockLabel(liveSplit)}) for this event.
                            </p>
                          ) : null}

                          <button
                            type="button"
                            className={TACTILE_BTN}
                            disabled={savingId === product.id || !draft.eventId}
                            onClick={() => void handleSave(product.id)}
                          >
                            {savingId === product.id ? 'Saving…' : 'Save Changes'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
