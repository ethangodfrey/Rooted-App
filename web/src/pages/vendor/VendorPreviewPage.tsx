import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorPreviewPage() {
  const { vendor } = useAuth();
  const [data, setData] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendor) {
      setLoading(false);
      return;
    }

    async function load() {
      const [vendorRes, productsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendor!.id).maybeSingle(),
        supabase.from('products').select('id, name, price').eq('vendor_id', vendor!.id).eq('status', 'active'),
      ]);
      setData(vendorRes.data);
      setProducts(productsRes.data ?? []);
      setLoading(false);
    }

    void load();
  }, [vendor]);

  if (loading) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  if (!vendor) {
    return <div className="app-empty">Sign in as a vendor to preview your storefront.</div>;
  }

  if (!data) {
    return (
      <VendorScreen>
        <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
        <VendorEmpty message="Could not load storefront preview." />
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
      <VendorHero
        eyebrow="Preview"
        title={data.business_name ?? 'Storefront'}
        subtitle={data.business_description ?? undefined}
        pill={products.length > 0 ? `${products.length} active` : undefined}
      />

      {products.length === 0 ? (
        <VendorEmpty message="No active products to show." />
      ) : (
        <VendorSection title="Catalog">
          <VendorListPanel>
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 p-3.5">
                <span className="flex min-w-0 items-center gap-3">
                  <IconBadge name="package" tone="orange" />
                  <span className="truncate text-sm font-semibold text-stone-800">{product.name}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-stone-600">{formatPrice(product.price)}</span>
              </div>
            ))}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
