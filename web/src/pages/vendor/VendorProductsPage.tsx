import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorProductsPage() {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!vendor) return;
      const { data } = await supabase.from('products').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
      setProducts(data ?? []);
      setLoading(false);
    }
    load();
  }, [vendor]);

  return (
    <div className="app-screen">
      <div className="app-page-header">
        <div>
          <p className="app-eyebrow">Manage</p>
          <h1 className="app-title">Products</h1>
        </div>
        <Link to="/vendor/products/new" className="app-btn app-btn--primary app-btn--small">+ Add</Link>
      </div>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : products.length === 0 ? (
        <div className="app-empty">No products yet.</div>
      ) : (
        <div className="app-list">
          {products.map((product) => (
            <div key={product.id} className="app-card">
              <Link to={`/vendor/products/${product.id}/edit`} className="app-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                {product.media_urls[0] ? (
                  <img src={product.media_urls[0]} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div className="app-row-icon">🛍️</div>
                )}
                <div className="app-row-body">
                  <p className="app-row-title">{product.name}</p>
                  <p className="app-row-meta">{formatPrice(product.price)} · {product.status}</p>
                </div>
              </Link>
              <Link to={`/vendor/products/${product.id}/availability`} className="app-row-meta" style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600, color: 'var(--color-forest)' }}>
                Event availability →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
