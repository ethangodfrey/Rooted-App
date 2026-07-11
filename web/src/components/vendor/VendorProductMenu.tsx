import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { formatPrice } from '@/lib/format';
import {
  filterProductsByTab,
  isProductReservable,
  productMenuTabs,
  type MenuProduct,
} from '@/lib/product-menu';

interface VendorProductMenuProps {
  products: MenuProduct[];
  accentColor?: string;
  onAddToCart?: (product: MenuProduct) => void;
}

export function VendorProductMenu({ products, accentColor = '#228B22', onAddToCart }: VendorProductMenuProps) {
  const tabs = useMemo(() => productMenuTabs(products), [products]);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'All');

  const filtered = useMemo(
    () => filterProductsByTab(products, activeTab),
    [products, activeTab],
  );

  if (products.length === 0) {
    return <p className="app-row-meta">No available products listed yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              activeTab === tab
                ? 'text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={activeTab === tab ? { backgroundColor: accentColor } : undefined}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((product) => {
          const reservable = isProductReservable(product);
          return (
            <div
              key={product.id}
              className="app-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
            >
              <FallbackImage
                src={product.media_urls?.[0]}
                variant="product"
                category={product.category}
                style={{
                  width: '100%',
                  maxWidth: 80,
                  height: 80,
                  borderRadius: 12,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/shopper/products/${product.id}`}
                  className="app-row-title block hover:underline"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {product.name}
                </Link>
                <p className="app-row-meta">{formatPrice(product.price)}</p>
                {product.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{product.description}</p>
                ) : null}
                {reservable ? (
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    Reservable
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                {reservable && onAddToCart ? (
                  <button
                    type="button"
                    className="app-btn app-btn--primary app-btn--small"
                    onClick={() => onAddToCart(product)}
                  >
                    Add
                  </button>
                ) : (
                  <Link
                    to={`/shopper/products/${product.id}`}
                    className="app-btn app-btn--secondary app-btn--small"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
