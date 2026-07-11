import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { useNow } from '@/hooks/use-now';
import { formatEventDisplayDate, formatPrice } from '@/lib/format';
import { vendorPath } from '@/lib/market-routes';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const now = useNow(60_000);
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    media_urls: string[];
    reserve_enabled: boolean;
    vendor_id: string;
    vendor: { business_name: string | null } | null;
  } | null>(null);
  const [availability, setAvailability] = useState<{
    id: string;
    available_quantity_presale: number;
    event: {
      id: string;
      name: string;
      start_datetime: string;
      end_datetime?: string | null;
      timezone?: string | null;
      hours_summary?: string | null;
      sync_metadata?: Record<string, unknown>;
      state?: string | null;
    } | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [productRes, availRes] = await Promise.all([
        supabase.from('products').select('id, name, description, price, media_urls, reserve_enabled, vendor_id, vendor:vendors(business_name)').eq('id', id).maybeSingle(),
        supabase.from('product_event_availability').select('id, available_quantity_presale, event:events(id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, state)').eq('product_id', id).gt('available_quantity_presale', 0),
      ]);
      setProduct(productRes.data as unknown as typeof product);
      setAvailability((availRes.data as unknown as typeof availability) ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!product) return <div className="app-empty">Product not found.</div>;

  const reservable = product.reserve_enabled && availability.length > 0;

  return (
    <div className="app-screen">
      <Link to={vendorPath(product.vendor_id)} className="app-back-link">← {product.vendor?.business_name ?? 'Vendor'}</Link>

      <FallbackImage
        src={product.media_urls[0]}
        variant="product"
        style={{
          width: '100%',
          borderRadius: '16px',
          marginBottom: '1rem',
          minHeight: '180px',
          maxHeight: '320px',
          objectFit: 'cover',
        }}
      />

      <h1 className="app-title">{product.name}</h1>
      <p className="app-subtitle">{formatPrice(product.price)}</p>
      {product.description ? <p>{product.description}</p> : null}

      {availability.length > 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Available for pickup</h2>
          <div className="app-list">
            {availability.map((row) => (
              <div key={row.id} className="app-card">
                <p className="app-row-title">{row.event?.name}</p>
                <p className="app-row-meta">
                  {row.event ? formatEventDisplayDate(row.event, now) : ''} · {row.available_quantity_presale} available
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {reservable ? (
        <button type="button" className="app-btn app-btn--primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate(`/shopper/checkout/${product.id}`)}>
          Reserve for pickup
        </button>
      ) : (
        <p className="app-row-meta" style={{ marginTop: '1.5rem' }}>Reservations not available for this product yet.</p>
      )}

      <ReviewsSection targetType="product" targetId={id!} />
    </div>
  );
}
