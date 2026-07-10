import { useRef, useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
import { ProductImage } from '@/components/ui/ProductImage';
import { useAuth } from '@/hooks/use-auth';
import { uploadProductImage } from '@/lib/upload';
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
}

interface ProductFormProps {
  initial?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  loading?: boolean;
}

function parseOptionalLimit(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return 'invalid';
  return value;
}

export function ProductForm({ initial, submitLabel, onSubmit, loading = false }: ProductFormProps) {
  const { user } = useAuth();
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
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setFormError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(user.id, file);
      setMediaUrls((prev) => [...prev, url]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Product name is required.';
    }

    const priceValue = Number.parseFloat(priceText);
    if (!priceText.trim()) {
      nextErrors.price = 'Enter a price for this product.';
    } else if (!Number.isFinite(priceValue) || priceValue < 0) {
      nextErrors.price = 'Enter a valid price (e.g. 12.50).';
    }

    let limitTotalValue: number | null = null;
    let limitPerShopperValue: number | null = null;
    if (reserveEnabled) {
      const parsed = parseOptionalLimit(limitTotal);
      if (parsed === 'invalid') {
        nextErrors.limitTotal = 'Reservation limit must be a whole number of 1 or more.';
      } else {
        limitTotalValue = parsed;
      }

      const parsedPer = parseOptionalLimit(limitPerShopper);
      if (parsedPer === 'invalid') {
        nextErrors.limitPerShopper = 'Per-shopper limit must be a whole number of 1 or more.';
      } else {
        limitPerShopperValue = parsedPer;
      }

      if (
        limitTotalValue != null &&
        limitPerShopperValue != null &&
        limitPerShopperValue > limitTotalValue
      ) {
        nextErrors.limitPerShopper = 'Per-shopper limit cannot exceed the total reservation limit.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(priceValue * 100),
      category: category.trim() || null,
      reserve_enabled: reserveEnabled,
      reserve_limit_total: limitTotalValue,
      reserve_limit_per_shopper: limitPerShopperValue,
      media_urls: mediaUrls,
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="app-input-group">
        <label>Photos</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          {mediaUrls.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              <ProductImage src={url} category={category} size={80} rounded="lg" />
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
                }}>
                ×
              </button>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => void handleFileChange(e)} />
        {uploading ? <p className="app-row-meta">Uploading…</p> : null}
      </div>

      <div className="app-input-group">
        <label htmlFor="product-name">Name</label>
        <input
          id="product-name"
          className={`app-input${fieldErrors.name ? ' app-input--invalid' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
        />
        <FieldError id="product-name-error" message={fieldErrors.name} />
      </div>
      <div className="app-input-group">
        <label htmlFor="product-description">Description</label>
        <textarea
          id="product-description"
          className="app-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="product-category">Category</label>
        <input
          id="product-category"
          className="app-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Produce, Baked goods"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="product-price">Price (USD)</label>
        <input
          id="product-price"
          className={`app-input${fieldErrors.price ? ' app-input--invalid' : ''}`}
          type="number"
          step="0.01"
          min="0"
          value={priceText}
          onChange={(e) => {
            setPriceText(e.target.value);
            clearFieldError('price');
          }}
          aria-invalid={Boolean(fieldErrors.price)}
          aria-describedby={fieldErrors.price ? 'product-price-error' : undefined}
        />
        <FieldError id="product-price-error" message={fieldErrors.price} />
      </div>

      <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input type="checkbox" checked={reserveEnabled} onChange={(e) => setReserveEnabled(e.target.checked)} />
        <span>Enable reservations</span>
      </label>

      {reserveEnabled ? (
        <>
          <div className="app-input-group">
            <label htmlFor="product-limit-total">Total reservation limit (optional)</label>
            <input
              id="product-limit-total"
              className={`app-input${fieldErrors.limitTotal ? ' app-input--invalid' : ''}`}
              value={limitTotal}
              onChange={(e) => {
                setLimitTotal(e.target.value);
                clearFieldError('limitTotal');
              }}
              placeholder="Leave blank for no cap"
              aria-invalid={Boolean(fieldErrors.limitTotal)}
              aria-describedby={fieldErrors.limitTotal ? 'product-limit-total-error' : undefined}
            />
            <FieldError id="product-limit-total-error" message={fieldErrors.limitTotal} />
          </div>
          <div className="app-input-group">
            <label htmlFor="product-limit-shopper">Per-shopper limit (optional)</label>
            <input
              id="product-limit-shopper"
              className={`app-input${fieldErrors.limitPerShopper ? ' app-input--invalid' : ''}`}
              value={limitPerShopper}
              onChange={(e) => {
                setLimitPerShopper(e.target.value);
                clearFieldError('limitPerShopper');
              }}
              placeholder="Leave blank for no cap"
              aria-invalid={Boolean(fieldErrors.limitPerShopper)}
              aria-describedby={fieldErrors.limitPerShopper ? 'product-limit-shopper-error' : undefined}
            />
            <FieldError id="product-limit-shopper-error" message={fieldErrors.limitPerShopper} />
          </div>
        </>
      ) : null}

      {formError ? <p className="app-error">{formError}</p> : null}

      <button type="submit" className="app-btn app-btn--primary" disabled={loading || uploading}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
