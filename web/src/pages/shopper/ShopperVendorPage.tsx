import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CartCheckoutSlider } from '@/components/checkout/CartCheckoutSlider';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { formatPrice } from '@/lib/format';
import {
  cartLineCount,
  cartSubtotal,
  loadStorefrontCart,
  saveStorefrontCart,
  upsertCartLine,
  type StorefrontCart,
} from '@/lib/storefront-cart';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';
import '@/components/checkout/cart-checkout-slider.css';
import '@/components/ui/ui.css';

interface VendorProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  reserve_enabled: boolean;
  media_urls: string[] | null;
}

export function ShopperVendorPage() {
  const { id } = useParams<{ id: string }>();
  const { isSaved, toggle, pending } = useSavedVendors();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [cart, setCart] = useState<StorefrontCart | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [vendorRes, productsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('products')
          .select('id, name, price, description, reserve_enabled, media_urls')
          .eq('vendor_id', id)
          .eq('status', 'active'),
      ]);
      setVendor(vendorRes.data);
      setProducts((productsRes.data as VendorProduct[] | null) ?? []);
      if (vendorRes.data && id) {
        setCart(
          loadStorefrontCart(id) ?? {
            vendorId: id,
            vendorName: vendorRes.data.business_name ?? 'Vendor',
            eventId: null,
            eventName: null,
            lines: [],
            updatedAt: new Date().toISOString(),
          },
        );
      }
      setLoading(false);
    }
    void load();
  }, [id]);

  const persistCart = useCallback(
    (next: StorefrontCart) => {
      setCart(next);
      saveStorefrontCart(next);
    },
    [],
  );

  const addToCart = useCallback(
    (product: VendorProduct) => {
      if (!vendor || !id || !product.reserve_enabled) return;
      const base: StorefrontCart =
        cart ??
        ({
          vendorId: id,
          vendorName: vendor.business_name ?? 'Vendor',
          eventId: null,
          eventName: null,
          lines: [],
          updatedAt: new Date().toISOString(),
        } as StorefrontCart);

      persistCart(
        upsertCartLine(base, {
          productId: product.id,
          name: product.name,
          price: product.price,
          mediaUrl: product.media_urls?.[0] ?? null,
          quantity: 1,
        }),
      );
    },
    [cart, id, persistCart, vendor],
  );

  const lineCount = useMemo(() => cartLineCount(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!vendor || !id) return <div className="app-empty">Vendor not found.</div>;

  const saved = isSaved(id);

  return (
    <div className="app-screen" style={{ paddingBottom: lineCount > 0 ? '5.5rem' : undefined }}>
      <div className="app-page-header">
        <Link to="/shopper/home" className="app-back-link">← Back</Link>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={pending}
          onClick={() => toggle(id)}>
          {saved ? '♥ Saved' : '♡ Save vendor'}
        </button>
      </div>

      <FallbackImage
        src={vendor.banner_url}
        variant="banner"
        category={vendor.category}
        style={{
          width: '100%',
          borderRadius: '16px',
          marginBottom: '1rem',
          maxHeight: '200px',
          minHeight: '120px',
          objectFit: 'cover',
        }}
      />

      <div className="app-row app-market-detail-header">
        <FallbackImage
          src={vendor.logo_url}
          variant="vendor-logo"
          category={vendor.category}
          style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
        />
        <div className="min-w-0 flex-1">
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
            <div key={product.id} className="app-card app-row">
              <Link to={`/shopper/products/${product.id}`} className="app-row-body" style={{ textDecoration: 'none', color: 'inherit' }}>
                <p className="app-row-title">{product.name}</p>
                <p className="app-row-meta">{formatPrice(product.price)}</p>
              </Link>
              {product.reserve_enabled ? (
                <button
                  type="button"
                  className="app-btn app-btn--primary app-btn--small"
                  onClick={() => addToCart(product)}>
                  Add
                </button>
              ) : (
                <Link to={`/shopper/products/${product.id}`} className="app-btn app-btn--secondary app-btn--small">
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <ReviewsSection targetType="vendor" targetId={id} />

      {lineCount > 0 && cart ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {lineCount} in cart · {formatPrice(subtotal)}
              </p>
              <p className="text-xs text-slate-500">Synced with vendor POS on checkout</p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => setCheckoutOpen(true)}>
              Checkout
            </button>
          </div>
        </div>
      ) : null}

      {cart ? (
        <CartCheckoutSlider
          cart={cart}
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onCartChange={persistCart}
        />
      ) : null}
    </div>
  );
}
