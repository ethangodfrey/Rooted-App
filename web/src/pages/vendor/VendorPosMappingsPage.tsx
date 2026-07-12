import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorEmpty,
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSecondaryButton,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { BACKEND_UNAVAILABLE_COPY } from '@/lib/api-url';
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
    <VendorScreen>
      <Link to="/vendor/pos" className="app-back-link">← POS</Link>
      <VendorHero eyebrow="POS" title="Item mappings" subtitle="Link Square items to Vendorly products" />

      {!isApiConfigured ? (
        <VendorFormPanel>
          <p className="m-0 text-sm font-semibold text-stone-800">Backend API required</p>
          <p className="m-0 mt-1 text-xs text-stone-500">{BACKEND_UNAVAILABLE_COPY}</p>
        </VendorFormPanel>
      ) : loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : mappings.length === 0 ? (
        <VendorEmpty message="No register items to map yet. Run a sync first." />
      ) : (
        <VendorListPanel>
          {mappings.map((mapping) => (
            <div key={mapping.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <IconBadge name="link" tone="stone" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-stone-800">
                    {mapping.providerItemName ?? mapping.providerCatalogObjectId}
                  </p>
                  {mapping.ignored ? (
                    <p className="m-0 mt-0.5 text-xs text-stone-500">Ignored</p>
                  ) : mapping.productId ? (
                    <p className="m-0 mt-0.5 text-xs text-stone-500">→ {productName(mapping.productId)}</p>
                  ) : (
                    <p className="m-0 mt-0.5 text-xs text-stone-500">Unmapped</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className={`app-input min-w-[160px] flex-1 ${VENDOR_PRESSABLE}`}
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
                <VendorSecondaryButton
                  disabled={saving}
                  onClick={() => void assign(mapping, { ignored: !mapping.ignored })}
                >
                  {mapping.ignored ? 'Unignore' : 'Ignore'}
                </VendorSecondaryButton>
              </div>
            </div>
          ))}
        </VendorListPanel>
      )}

      {error ? <p className="app-error">{error}</p> : null}
    </VendorScreen>
  );
}
