import { useRef, useState } from 'react';

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
  const [error, setError] = useState<string | null>(null);

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
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    const priceValue = Number.parseFloat(priceText);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('Enter a valid price (e.g. 12.50).');
      return;
    }

    let limitTotalValue: number | null = null;
    let limitPerShopperValue: number | null = null;
    if (reserveEnabled) {
      const parsed = parseOptionalLimit(limitTotal);
      if (parsed === 'invalid') {
        setError('Reservation limit must be a whole number of 1 or more.');
        return;
      }
      limitTotalValue = parsed;

      const parsedPer = parseOptionalLimit(limitPerShopper);
      if (parsedPer === 'invalid') {
        setError('Per-shopper limit must be a whole number of 1 or more.');
        return;
      }
      limitPerShopperValue = parsedPer;

      if (
        limitTotalValue != null &&
        limitPerShopperValue != null &&
        limitPerShopperValue > limitTotalValue
      ) {
        setError('Per-shopper limit cannot exceed the total reservation limit.');
        return;
      }
    }

    setError(null);
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
              <img src={url} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }} />
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
        <label>Name</label>
        <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Description</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Category</label>
        <input className="app-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Produce, Baked goods" />
      </div>
      <div className="app-input-group">
        <label>Price (USD)</label>
        <input className="app-input" type="number" step="0.01" min="0" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
      </div>

      <label style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input type="checkbox" checked={reserveEnabled} onChange={(e) => setReserveEnabled(e.target.checked)} />
        <span>Enable reservations</span>
      </label>

      {reserveEnabled ? (
        <>
          <div className="app-input-group">
            <label>Total reservation limit (optional)</label>
            <input className="app-input" value={limitTotal} onChange={(e) => setLimitTotal(e.target.value)} placeholder="Leave blank for no cap" />
          </div>
          <div className="app-input-group">
            <label>Per-shopper limit (optional)</label>
            <input className="app-input" value={limitPerShopper} onChange={(e) => setLimitPerShopper(e.target.value)} placeholder="Leave blank for no cap" />
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
