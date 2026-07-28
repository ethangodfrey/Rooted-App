import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ProductImage } from '@/components/ui/ProductImage';
import { VendorCatalogSkeleton } from '@/components/vendor/VendorCatalogSkeleton';
import {
  VendorActionGrid,
  VendorActionTile,
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
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
      if (!vendor) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });
      setProducts(data ?? []);
      setLoading(false);
    }
    load();
  }, [vendor]);

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Manage"
        title="Products"
        pill={loading ? undefined : `${products.length} listed`}
      />

      <VendorActionGrid>
        <VendorActionTile
          to="/vendor/products/new"
          title="Add product"
          subtitle="Create new listing"
          icon="plus"
          tone="orange"
        />
      </VendorActionGrid>

      {loading ? (
        <VendorCatalogSkeleton count={4} />
      ) : products.length === 0 ? (
        <VendorEmpty message="No products yet." />
      ) : (
        <VendorSection title="Catalog">
          <VendorListPanel>
            {products.map((product) => (
              <div key={product.id} className="p-3.5">
                <Link
                  to={`/vendor/products/${product.id}/edit`}
                  className={`flex items-center gap-3 no-underline text-inherit ${VENDOR_PRESSABLE}`}
                >
                  <ProductImage
                    src={product.media_urls[0]}
                    category={product.category}
                    name={product.name}
                    size={48}
                    rounded="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-800">
                      {product.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {formatPrice(product.price)} · {product.status}
                    </span>
                  </span>
                </Link>
                <Link
                  to={`/vendor/products/${product.id}/availability`}
                  className={`mt-2 inline-block text-xs font-semibold text-amber-700 ${VENDOR_PRESSABLE}`}
                >
                  Event availability →
                </Link>
              </div>
            ))}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
