import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSavedItems } from '@/hooks/use-saved-items';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type SavedFilter = 'all' | 'vendor' | 'chef' | 'product';

const FILTERS: { value: SavedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'chef', label: 'Chefs' },
  { value: 'product', label: 'Products' },
];

interface SavedRow {
  type: 'vendor' | 'chef' | 'product';
  id: string;
  title: string;
  meta: string | null;
  to: string;
  icon: string;
}

export function ShopperSavedPage() {
  const { loaded, savedVendorIds, savedChefIds, savedProductIds } = useSavedItems();
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const vendorKey = savedVendorIds.join(',');
  const chefKey = savedChefIds.join(',');
  const productKey = savedProductIds.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!loaded) return;
      if (!savedVendorIds.length && !savedChefIds.length && !savedProductIds.length) {
        setRows([]);
        return;
      }

      setLoadingDetails(true);
      const [vendorsRes, chefsRes, productsRes] = await Promise.all([
        savedVendorIds.length
          ? supabase.from('vendors').select('id, business_name, category').in('id', savedVendorIds)
          : Promise.resolve({ data: [] as { id: string; business_name: string | null; category: string | null }[] }),
        savedChefIds.length
          ? supabase
              .from('chefs')
              .select('id, display_name, home_base_city, home_base_state')
              .in('id', savedChefIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string; home_base_city: string | null; home_base_state: string | null }[] }),
        savedProductIds.length
          ? supabase.from('products').select('id, name, price').in('id', savedProductIds)
          : Promise.resolve({ data: [] as { id: string; name: string; price: number }[] }),
      ]);

      if (cancelled) return;

      const next: SavedRow[] = [];
      for (const v of vendorsRes.data ?? []) {
        next.push({
          type: 'vendor',
          id: v.id,
          title: v.business_name ?? 'Vendor',
          meta: v.category,
          to: `/shopper/vendors/${v.id}`,
          icon: '🏪',
        });
      }
      for (const c of chefsRes.data ?? []) {
        next.push({
          type: 'chef',
          id: c.id,
          title: c.display_name,
          meta: [c.home_base_city, c.home_base_state].filter(Boolean).join(', ') || 'Private chef',
          to: `/shopper/chefs/${c.id}`,
          icon: '👨‍🍳',
        });
      }
      for (const p of productsRes.data ?? []) {
        next.push({
          type: 'product',
          id: p.id,
          title: p.name,
          meta: formatPrice(p.price),
          to: `/shopper/products/${p.id}`,
          icon: '🧺',
        });
      }

      setRows(next);
      setLoadingDetails(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, vendorKey, chefKey, productKey]);

  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.type === filter)),
    [filter, rows],
  );

  return (
    <div className="app-screen">
      <Link to="/shopper/profile" className="app-back-link">
        ← Profile
      </Link>
      <p className="app-eyebrow">Your collection</p>
      <h1 className="app-title">Saved</h1>
      <p className="app-subtitle">Vendors, chefs, and products you&apos;ve saved.</p>

      <div className="app-chip-row">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`app-chip${filter === f.value ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loaded || loadingDetails ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="app-empty">
          {rows.length === 0
            ? 'Tap the heart on a vendor, chef, or product to save it here.'
            : 'Nothing saved in this category yet.'}
        </p>
      ) : (
        <div className="app-list">
          {visibleRows.map((row) => (
            <Link
              key={`${row.type}-${row.id}`}
              to={row.to}
              className="app-card app-card--pressable app-row"
            >
              <div className="app-row-icon">{row.icon}</div>
              <div className="app-row-body">
                <p className="app-row-title">{row.title}</p>
                {row.meta ? <p className="app-row-meta">{row.meta}</p> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
