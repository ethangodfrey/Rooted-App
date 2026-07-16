'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  allocateHybridStock,
  formatHybridStockLabel,
  formatHybridStockPercentLabel,
  percentFromQuantities,
} from '@/lib/hybrid-stock';
import type {
  InventoryApiResponse,
  InventoryAvailabilityRow,
  InventoryEventRow,
  InventoryProductRow,
} from '@/lib/inventory/types';

export interface InventoryManagerProps {
  vendorId: string;
  accessToken?: string | null;
  apiBaseUrl?: string;
  /** Marketplace URL for Add Product deep-link (optional). */
  marketplaceUrl?: string | null;
}

interface DraftState {
  eventId: string;
  totalStock: number;
  preOrderPercent: number;
}

const TACTILE_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function draftFromAvailability(
  productId: string,
  eventId: string,
  availability: InventoryAvailabilityRow[],
): DraftState {
  const row = availability.find((r) => r.product_id === productId && r.event_id === eventId);
  const presale = row?.available_quantity_presale ?? 0;
  const inperson = row?.available_quantity_inperson ?? 0;
  return {
    eventId,
    totalStock: presale + inperson,
    preOrderPercent: percentFromQuantities(presale, inperson),
  };
}

function HybridSlider({
  id,
  totalStock,
  preOrderPercent,
  onChange,
  disabled,
}: {
  id: string;
  totalStock: number;
  preOrderPercent: number;
  onChange: (percent: number) => void;
  disabled?: boolean;
}) {
  const split = allocateHybridStock(totalStock, preOrderPercent);
  const pct = split.preOrderPercent;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-white/55">
        <span>Digital Pre-Order</span>
        <span>In-Person Walk-Up</span>
      </div>
      <label className="sr-only" htmlFor={id}>
        Allocate batch between digital pre-orders and in-person walk-ups
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        aria-valuetext={formatHybridStockPercentLabel(split)}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full accent-orange-500"
        style={{
          background: `linear-gradient(to right, #ea580c 0%, #f97316 ${pct}%, rgba(148,163,184,0.35) ${pct}%, rgba(148,163,184,0.35) 100%)`,
        }}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      />
      <p className="m-0 text-center text-xl font-extrabold tracking-tight text-orange-500 tabular-nums">
        {formatHybridStockPercentLabel(split)}
      </p>
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-white/55">
        <span>{formatHybridStockLabel(split)}</span>
        <span>{split.preOrder + split.walkUp} total</span>
      </div>
    </div>
  );
}

export function InventoryManager({
  vendorId,
  accessToken,
  apiBaseUrl = '',
  marketplaceUrl,
}: InventoryManagerProps) {
  const [products, setProducts] = useState<InventoryProductRow[]>([]);
  const [events, setEvents] = useState<InventoryEventRow[]>([]);
  const [availability, setAvailability] = useState<InventoryAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const defaultEventId = useMemo(() => {
    if (events.length === 0) return '';
    const now = Date.now();
    const upcoming = events.find((ev) => new Date(ev.start_datetime).getTime() >= now);
    return (upcoming ?? events[events.length - 1]).id;
  }, [events]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${apiBaseUrl}/api/vendor/inventory?vendorId=${encodeURIComponent(vendorId)}`,
        { headers },
      );
      const body = (await res.json().catch(() => null)) as
        | (InventoryApiResponse & { error?: string })
        | null;
      if (!res.ok) {
        throw new Error(body?.error || `Inventory request failed (${res.status})`);
      }
      setProducts(body?.products ?? []);
      setEvents(body?.events ?? []);
      setAvailability(body?.availability ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory');
      setProducts([]);
      setEvents([]);
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId, accessToken, apiBaseUrl]);

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
    setDrafts((prev) => ({ ...prev, [productId]: buildDraft(productId) }));
    setExpandedId(productId);
  }

  function updateDraft(productId: string, patch: Partial<DraftState>) {
    setDrafts((prev) => {
      const base = prev[productId] ?? buildDraft(productId);
      return { ...prev, [productId]: { ...base, ...patch } };
    });
  }

  async function handleSave(productId: string) {
    const draft = drafts[productId] ?? buildDraft(productId);
    if (!draft.eventId) {
      setError('Join a market event before allocating stock.');
      return;
    }
    setSavingId(productId);
    setError(null);
    setSaveMessage(null);
    try {
      const headers: HeadersInit = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(`${apiBaseUrl}/api/vendor/inventory`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          vendorId,
          productId,
          eventId: draft.eventId,
          totalStock: draft.totalStock,
          preOrderPercent: draft.preOrderPercent,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        preOrder?: number;
        walkUp?: number;
        preOrderPercent?: number;
      } | null;
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);

      const split = allocateHybridStock(draft.totalStock, draft.preOrderPercent);
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
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          let preOrder = 0;
          let walkUp = 0;
          const nextAvail = [
            ...availability.filter(
              (r) => !(r.product_id === productId && r.event_id === draft.eventId),
            ),
            {
              product_id: productId,
              event_id: draft.eventId,
              available_quantity_presale: split.preOrder,
              available_quantity_inperson: split.walkUp,
            },
          ];
          for (const row of nextAvail) {
            if (row.product_id !== productId) continue;
            preOrder += row.available_quantity_presale;
            walkUp += row.available_quantity_inperson;
          }
          return { ...p, preOrder, walkUp, totalStock: preOrder + walkUp };
        }),
      );
      setSaveMessage(`Saved ${formatHybridStockLabel(split)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save allocation');
    } finally {
      setSavingId(null);
    }
  }

  const addProductHref =
    marketplaceUrl != null && marketplaceUrl !== ''
      ? `${marketplaceUrl.replace(/\/$/, '')}/vendor/products/new`
      : null;

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-8 space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-20 animate-pulse rounded-xl bg-white/10" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
          Catalog
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">Inventory</h1>
        <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/70 md:text-base">
          Allocate each batch between online pre-orders and in-person walk-ups so market day never
          starts empty.
        </p>
      </header>

      {addProductHref ? (
        <a href={addProductHref} className={`${TACTILE_BTN} mb-6`}>
          Add Product
        </a>
      ) : (
        <button type="button" className={`${TACTILE_BTN} mb-6`} disabled title="Set NEXT_PUBLIC_MARKETPLACE_URL">
          Add Product
        </button>
      )}

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {saveMessage ? (
        <p className="mb-4 text-sm font-semibold text-orange-400" role="status">
          {saveMessage}
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center text-sm text-white/65">
          No products yet. Add your first listing to start allocating stock.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {products.map((product) => {
            const isOpen = expandedId === product.id;
            const draft = isOpen ? (drafts[product.id] ?? buildDraft(product.id)) : null;
            const liveSplit = draft
              ? allocateHybridStock(draft.totalStock, draft.preOrderPercent)
              : null;
            const thumb = product.media_urls[0];

            return (
              <li key={product.id} className="rounded-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 rounded-xl bg-transparent px-1 py-5 text-left transition-colors hover:bg-orange-500/10"
                  onClick={() => openEditor(product.id)}
                  aria-expanded={isOpen}
                >
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-xs font-bold text-white/50">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      'SKU'
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Name
                    </span>
                    <span className="mt-0.5 block truncate text-base font-bold tracking-tight">
                      {product.name}
                    </span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Base Price
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-orange-500">
                      {formatUsd(product.price)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Total Stock
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums text-orange-500">
                      {product.totalStock}
                    </span>
                    {product.totalStock > 0 ? (
                      <span className="max-w-[11rem] text-right text-xs font-bold text-orange-500">
                        {formatHybridStockPercentLabel({
                          preOrder: product.preOrder,
                          walkUp: product.walkUp,
                          preOrderPercent: percentFromQuantities(product.preOrder, product.walkUp),
                        })}
                      </span>
                    ) : null}
                  </span>
                </button>

                {isOpen && draft ? (
                  <div className="flex flex-col gap-4 px-1 pb-6">
                    {events.length === 0 ? (
                      <p className="m-0 text-sm font-medium text-white/65">
                        Join a market event in the marketplace app before saving hybrid allocation.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          <label
                            htmlFor={`event-${product.id}`}
                            className="text-[11px] font-bold uppercase tracking-widest text-orange-400"
                          >
                            Market event
                          </label>
                          <select
                            id={`event-${product.id}`}
                            className="w-full rounded-xl border border-orange-500/35 bg-[#121a36] px-4 py-3.5 text-sm font-semibold text-zinc-50 outline-none focus:border-orange-500"
                            value={draft.eventId}
                            onChange={(e) =>
                              updateDraft(
                                product.id,
                                draftFromAvailability(product.id, e.target.value, availability),
                              )
                            }
                          >
                            {events.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label
                            htmlFor={`stock-${product.id}`}
                            className="text-[11px] font-bold uppercase tracking-widest text-orange-400"
                          >
                            Batch total (units)
                          </label>
                          <input
                            id={`stock-${product.id}`}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            className="w-full rounded-xl border border-orange-500/35 bg-[#121a36] px-4 py-4 text-xl font-bold tabular-nums text-zinc-50 outline-none focus:border-orange-500"
                            value={draft.totalStock}
                            onChange={(e) => {
                              const next = Number.parseInt(e.target.value || '0', 10);
                              updateDraft(product.id, {
                                totalStock: Number.isFinite(next) ? Math.max(0, next) : 0,
                              });
                            }}
                          />
                        </div>

                        <HybridSlider
                          id={`hybrid-${product.id}`}
                          totalStock={draft.totalStock}
                          preOrderPercent={draft.preOrderPercent}
                          disabled={savingId === product.id}
                          onChange={(percent) =>
                            updateDraft(product.id, { preOrderPercent: percent })
                          }
                        />

                        {liveSplit ? (
                          <p className="m-0 text-sm font-medium text-white/65">
                            Saving will write{' '}
                            <strong className="font-extrabold text-orange-500">
                              {liveSplit.preOrder} pre-order / {liveSplit.walkUp} walk-up
                            </strong>{' '}
                            for this event.
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
      )}
    </section>
  );
}

export default InventoryManager;
