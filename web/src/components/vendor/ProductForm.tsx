import { useRef, useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { useAuth } from '@/hooks/use-auth';
import {
  combinationLabel,
  emptyVariantsPayload,
  parseVariants,
  regenerateCombinations,
  type ProductVariantsPayload,
  type VariantAttribute,
  type VariantCombination,
} from '@/lib/product-variants';
import { uploadProductImage } from '@/lib/upload';
import { isMicroBrandVendor } from '@/lib/vendor-types';
import '@/components/ui/ui.css';

export interface ProductFormValues {
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  reserve_enabled: boolean;
  reserve_limit_total: number | null;
  reserve_limit_per_shopper: number | null;
  media_urls: string[];
  is_snap_eligible: boolean;
  has_variants: boolean;
  variants: ProductVariantsPayload;
}

interface ProductFormProps {
  initial?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  loading?: boolean;
  /** When true (micro_brand vendor), variants UI defaults on. */
  microBrand?: boolean;
}

type ProductField = 'name' | 'price' | 'limitTotal' | 'limitPerShopper';

function parseOptionalLimit(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return 'invalid';
  return value;
}

export function ProductForm({
  initial,
  submitLabel,
  onSubmit,
  loading = false,
  microBrand = false,
}: ProductFormProps) {
  const { user, vendor } = useAuth();
  const isMicro = microBrand || isMicroBrandVendor(vendor?.vendor_type);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceText, setPriceText] = useState(
    initial?.price != null ? (initial.price / 100).toFixed(2) : '',
  );
  const [category, setCategory] = useState(initial?.category ?? '');
  const [reserveEnabled, setReserveEnabled] = useState(initial?.reserve_enabled ?? true);
  const [limitTotal, setLimitTotal] = useState(
    initial?.reserve_limit_total != null ? String(initial.reserve_limit_total) : '',
  );
  const [limitPerShopper, setLimitPerShopper] = useState(
    initial?.reserve_limit_per_shopper != null ? String(initial.reserve_limit_per_shopper) : '',
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>(initial?.media_urls ?? []);
  const [snapEligible, setSnapEligible] = useState(initial?.is_snap_eligible ?? false);
  const [hasVariants, setHasVariants] = useState(
    initial?.has_variants ?? (isMicro && Boolean(initial?.variants?.combinations?.length)),
  );
  const [variants, setVariants] = useState<ProductVariantsPayload>(
    initial?.variants ? parseVariants(initial.variants) : emptyVariantsPayload(),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProductField, string>>>({});

  function clearFieldError(field: ProductField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateAttribute(index: number, patch: Partial<VariantAttribute>) {
    setVariants((prev) => {
      const attributes = prev.attributes.map((attr, i) =>
        i === index ? { ...attr, ...patch } : attr,
      );
      return { ...prev, attributes };
    });
  }

  function rebuildCombos(nextAttrs: VariantAttribute[], priceCents: number) {
    setVariants((prev) => ({
      attributes: nextAttrs,
      combinations: regenerateCombinations(nextAttrs, prev.combinations, priceCents),
    }));
  }

  function updateCombo(id: string, patch: Partial<VariantCombination>) {
    setVariants((prev) => ({
      ...prev,
      combinations: prev.combinations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(user.id, file);
      setMediaUrls((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextFieldErrors: Partial<Record<ProductField, string>> = {};

    if (!name.trim()) {
      nextFieldErrors.name = 'Product name is required.';
    }

    const priceValue = Number.parseFloat(priceText);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      nextFieldErrors.price = 'Enter a valid price (e.g. 12.50).';
    }

    let limitTotalValue: number | null = null;
    let limitPerShopperValue: number | null = null;
    if (reserveEnabled) {
      const parsed = parseOptionalLimit(limitTotal);
      if (parsed === 'invalid') {
        nextFieldErrors.limitTotal = 'Reservation limit must be a whole number of 1 or more.';
      } else {
        limitTotalValue = parsed;
      }

      const parsedPer = parseOptionalLimit(limitPerShopper);
      if (parsedPer === 'invalid') {
        nextFieldErrors.limitPerShopper = 'Per-shopper limit must be a whole number of 1 or more.';
      } else {
        limitPerShopperValue = parsedPer;
      }

      if (
        limitTotalValue != null &&
        limitPerShopperValue != null &&
        limitPerShopperValue > limitTotalValue
      ) {
        nextFieldErrors.limitPerShopper = 'Per-shopper limit cannot exceed the total reservation limit.';
      }
    }

    if (hasVariants && variants.combinations.length === 0) {
      setError('Add at least one attribute with values, then generate variant combinations.');
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    const priceCents = Math.round(priceValue * 100);
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: priceCents,
      category: category.trim() || null,
      reserve_enabled: reserveEnabled,
      reserve_limit_total: limitTotalValue,
      reserve_limit_per_shopper: limitPerShopperValue,
      media_urls: mediaUrls,
      is_snap_eligible: snapEligible,
      has_variants: hasVariants,
      variants: hasVariants ? variants : emptyVariantsPayload(),
    });
  }

  const defaultPriceCents = Math.round((Number.parseFloat(priceText) || 0) * 100);

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="app-input-group">
        <label>Photos</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          {mediaUrls.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              <FallbackImage
                src={url}
                variant="product"
                category={category}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: '#1a1a1a',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => void handleFileChange(e)} />
        {uploading ? <p className="app-row-meta">Uploading…</p> : null}
      </div>

      <div className="app-input-group">
        <label>Name</label>
        <input
          className={`app-input${fieldErrors.name ? ' app-input--invalid' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
        />
        <FieldError message={fieldErrors.name} />
      </div>
      <div className="app-input-group">
        <label>Description</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Category</label>
        <input
          className="app-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Apparel, Crafts, Produce"
        />
      </div>
      <div className="app-input-group">
        <label>Base price (USD)</label>
        <input
          className={`app-input${fieldErrors.price ? ' app-input--invalid' : ''}`}
          type="number"
          step="0.01"
          min="0"
          value={priceText}
          onChange={(e) => {
            setPriceText(e.target.value);
            clearFieldError('price');
          }}
        />
        <FieldError message={fieldErrors.price} />
      </div>

      <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input type="checkbox" checked={reserveEnabled} onChange={(e) => setReserveEnabled(e.target.checked)} />
        <span>Enable reservations</span>
      </label>

      <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3">
        <span>
          <span className="block text-sm font-bold text-emerald-800">SNAP / EBT Eligible Product</span>
          <span className="mt-0.5 block text-xs font-medium text-emerald-900/70">
            Show an emerald SNAP badge in discovery when shoppers filter for EBT-friendly items.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-checked={snapEligible}
          className="h-5 w-5 accent-emerald-600"
          checked={snapEligible}
          onChange={(e) => setSnapEligible(e.target.checked)}
        />
      </label>

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <label className="mb-3 flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-bold text-slate-900">Product variants</span>
              <span className="mt-0.5 block text-xs font-medium text-slate-600">
                {isMicro
                  ? 'Recommended for Micro-Brands — Size / Color with price and stock per combo.'
                  : 'Optional — add Size / Color attributes and set price/stock per combination.'}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={hasVariants}
              className="h-5 w-5 accent-orange-600"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
            />
          </label>

          {hasVariants ? (
            <>
              <div className="mb-3 flex flex-col gap-3">
                {variants.attributes.map((attr, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <input
                        className="app-input"
                        value={attr.name}
                        placeholder="Attribute (e.g. Size)"
                        onChange={(e) => updateAttribute(index, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="app-btn app-btn--secondary shrink-0"
                        onClick={() => {
                          const next = variants.attributes.filter((_, i) => i !== index);
                          rebuildCombos(next, defaultPriceCents);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      className="app-input"
                      value={attr.values.join(', ')}
                      placeholder="Values comma-separated (e.g. S, M, L)"
                      onChange={(e) =>
                        updateAttribute(index, {
                          values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="app-btn app-btn--secondary"
                  onClick={() =>
                    setVariants((prev) => ({
                      ...prev,
                      attributes: [...prev.attributes, { name: '', values: [] }],
                    }))
                  }
                >
                  Add attribute
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  onClick={() => rebuildCombos(variants.attributes, defaultPriceCents)}
                >
                  Generate combinations
                </button>
              </div>

              {variants.combinations.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {variants.combinations.map((combo) => (
                    <li
                      key={combo.id}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 md:grid-cols-[1fr_7rem_5rem]"
                    >
                      <p className="m-0 self-center text-sm font-semibold text-slate-800">
                        {combinationLabel(combo)}
                      </p>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Price ($)
                        <input
                          className="app-input mt-1"
                          type="number"
                          step="0.01"
                          min="0"
                          value={(combo.price_cents / 100).toFixed(2)}
                          onChange={(e) => {
                            const dollars = Number.parseFloat(e.target.value);
                            updateCombo(combo.id, {
                              price_cents: Number.isFinite(dollars)
                                ? Math.round(dollars * 100)
                                : combo.price_cents,
                            });
                          }}
                        />
                      </label>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Stock
                        <input
                          className="app-input mt-1"
                          type="number"
                          min="0"
                          step="1"
                          value={combo.stock}
                          onChange={(e) =>
                            updateCombo(combo.id, {
                              stock: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                            })
                          }
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-xs text-slate-500">
                  Add attributes, then tap Generate combinations (e.g. Size: M, Color: Black, Stock: 10).
                </p>
              )}
            </>
          ) : null}
      </div>

      {reserveEnabled ? (
        <>
          <div className="app-input-group">
            <label>Total reservation limit (optional)</label>
            <input
              className={`app-input${fieldErrors.limitTotal ? ' app-input--invalid' : ''}`}
              value={limitTotal}
              onChange={(e) => {
                setLimitTotal(e.target.value);
                clearFieldError('limitTotal');
              }}
              placeholder="Leave blank for no cap"
            />
            <FieldError message={fieldErrors.limitTotal} />
          </div>
          <div className="app-input-group">
            <label>Per-shopper limit (optional)</label>
            <input
              className={`app-input${fieldErrors.limitPerShopper ? ' app-input--invalid' : ''}`}
              value={limitPerShopper}
              onChange={(e) => {
                setLimitPerShopper(e.target.value);
                clearFieldError('limitPerShopper');
              }}
              placeholder="Leave blank for no cap"
            />
            <FieldError message={fieldErrors.limitPerShopper} />
          </div>
        </>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}

      <button type="submit" className="app-btn app-btn--primary" disabled={loading || uploading}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
