import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorPreviewPage() {
  const { vendor } = useAuth();
  const [data, setData] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);

  useEffect(() => {
    if (!vendor) return;
    async function load() {
      const [vendorRes, productsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendor!.id).maybeSingle(),
        supabase.from('products').select('id, name, price').eq('vendor_id', vendor!.id).eq('status', 'active'),
      ]);
      setData(vendorRes.data);
      setProducts(productsRes.data ?? []);
    }
    load();
  }, [vendor]);

  if (!vendor || !data) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  return (
    <div className="app-screen">
      <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
      <p className="app-eyebrow">Preview</p>
      <h1 className="app-title">{data.business_name}</h1>
      {data.business_description ? <p className="app-subtitle">{data.business_description}</p> : null}

      <div className="app-list" style={{ marginTop: '1.5rem' }}>
        {products.map((product) => (
          <div key={product.id} className="app-card app-row" style={{ justifyContent: 'space-between' }}>
            <span>{product.name}</span>
            <span>{formatPrice(product.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
