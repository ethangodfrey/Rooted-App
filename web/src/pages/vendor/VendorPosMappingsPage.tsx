import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { posApi } from '@/lib/pos-api';
import { supabase } from '@/lib/supabase';
import type { PosProductMapping } from '@/types/pos';
import '@/components/ui/ui.css';

interface ProductOption {
  id: string;
  name: string;
}

export function VendorPosMappingsPage() {
  const { vendor } = useAuth();
  const [mappings, setMappings] = useState<PosProductMapping[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured || !vendor) {
      setLoading(false);
      return;
    }
    try {
      const [maps, productsRes] = await Promise.all([
        posApi.listMappings(),
        supabase.from('products').select('id, name').eq('vendor_id', vendor.id),
      ]);
      setMappings(maps);
      setProducts((productsRes.data as ProductOption[]) ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vendor]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(
    mapping: PosProductMapping,
    change: { productId?: string | null; ignored?: boolean },
  ) {
    setSaving(true);
    setError(null);
    try {
      await posApi.upsertMapping({
        connectionId: mapping.connectionId,
        providerCatalogObjectId: mapping.providerCatalogObjectId,
        ...change,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function productName(productId?: string | null): string | null {
    if (!productId) return null;
    return products.find((p) => p.id === productId)?.name ?? 'Mapped product';
  }

  return (
    <div className="app-screen">
      <Link to="/vendor/pos" className="app-back-link">← POS</Link>
      <h1 className="app-title">Item mappings</h1>
      <p className="app-subtitle">Link Square catalog items to your Rooted products.</p>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : mappings.length === 0 ? (
        <div className="app-empty">No register items to map yet. Run a sync first.</div>
      ) : (
        <div className="app-list">
          {mappings.map((mapping) => (
            <div key={mapping.id} className="app-card">
              <p className="app-row-title">{mapping.providerItemName ?? mapping.providerCatalogObjectId}</p>
              {mapping.ignored ? (
                <p className="app-row-meta">Ignored</p>
              ) : mapping.productId ? (
                <p className="app-row-meta">→ {productName(mapping.productId)}</p>
              ) : (
                <p className="app-row-meta">Unmapped</p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                <select
                  className="app-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={mapping.productId ?? ''}
                  disabled={saving || mapping.ignored}
                  onChange={(e) =>
                    void assign(mapping, { productId: e.target.value || null, ignored: false })
                  }>
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="app-btn app-btn--secondary app-btn--small"
                  disabled={saving}
                  onClick={() => void assign(mapping, { ignored: !mapping.ignored })}>
                  {mapping.ignored ? 'Unignore' : 'Ignore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
