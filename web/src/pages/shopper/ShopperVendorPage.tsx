import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperVendorPage() {
  const { id } = useParams<{ id: string }>();
  const { isSaved, toggle, pending } = useSavedVendors();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; price: number; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [vendorRes, productsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).maybeSingle(),
        supabase.from('products').select('id, name, price, description').eq('vendor_id', id).eq('status', 'active'),
      ]);
      setVendor(vendorRes.data);
      setProducts(productsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!vendor) return <div className="app-empty">Vendor not found.</div>;

  const saved = isSaved(id!);

  return (
    <div className="app-screen">
      <div className="app-page-header">
        <Link to="/shopper/home" className="app-back-link">← Back</Link>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={pending}
          onClick={() => toggle(id!)}
        >
          {saved ? '♥ Saved' : '♡ Save vendor'}
        </button>
      </div>

      {vendor.banner_url ? (
        <img src={vendor.banner_url} alt="" style={{ width: '100%', borderRadius: '16px', marginBottom: '1rem', maxHeight: '200px', objectFit: 'cover' }} />
      ) : null}

      <div className="app-row" style={{ marginBottom: '1rem' }}>
        {vendor.logo_url ? (
          <img src={vendor.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
        ) : (
          <div className="app-row-icon">🏪</div>
        )}
        <div>
          <h1 className="app-title" style={{ margin: 0 }}>{vendor.business_name}</h1>
          {vendor.category ? <p className="app-row-meta">{vendor.category}</p> : null}
          <TrustBadges userId={vendor.user_id} />
        </div>
      </div>

      {vendor.business_description ? <p className="app-subtitle">{vendor.business_description}</p> : null}
      {vendor.product_summary ? <p>{vendor.product_summary}</p> : null}

      <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.75rem' }}>Products</h2>
      {products.length === 0 ? (
        <p className="app-row-meta">No active products yet.</p>
      ) : (
        <div className="app-list">
          {products.map((product) => (
            <Link key={product.id} to={`/shopper/products/${product.id}`} className="app-card app-card--pressable app-row">
              <div className="app-row-body">
                <p className="app-row-title">{product.name}</p>
                <p className="app-row-meta">{formatPrice(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ReviewsSection targetType="vendor" targetId={id!} />
    </div>
  );
}
