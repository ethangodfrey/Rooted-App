import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { DiscoverThumb } from '@/components/discover/DiscoverThumb';
import { formatEventDate, formatPrice } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { fetchCuratedLeftovers, formatExpiresIn, type CuratedLeftover } from '@/lib/leftovers';
import { pickListingDisplayImage } from '@/lib/product-image';
import { fetchSuggestedProducts, type SuggestedProduct } from '@/lib/suggested-products';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type Filter = 'all' | 'events' | 'vendors' | 'products';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'products', label: 'Products' },
];

export function ShopperHomePage() {
  const { user, shopper } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [leftovers, setLeftovers] = useState<CuratedLeftover[]>([]);
  const [leftoversLoading, setLeftoversLoading] = useState(true);
  const [results, setResults] = useState<{
    events: { id: string; name: string; city: string | null; state: string | null; start_datetime: string }[];
    vendors: { id: string; business_name: string | null; category: string | null }[];
    products: { id: string; name: string; price: number; vendor: { business_name: string | null } | null }[];
  }>({ events: [], vendors: [], products: [] });

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  useEffect(() => {
    if (!active) {
      setResults({ events: [], vendors: [], products: [] });
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${trimmed}%`;
      const [eventsRes, vendorsRes, productsRes] = await Promise.all([
        filter === 'all' || filter === 'events'
          ? supabase.from('events').select('id, name, city, state, start_datetime').eq('visibility_status', 'public').ilike('name', like).limit(10)
          : Promise.resolve({ data: [] }),
        filter === 'all' || filter === 'vendors'
          ? supabase.from('vendors').select('id, business_name, category').eq('approval_status', 'approved').ilike('business_name', like).limit(10)
          : Promise.resolve({ data: [] }),
        filter === 'all' || filter === 'products'
          ? supabase.from('products').select('id, name, price, vendor:vendors(business_name)').eq('status', 'active').ilike('name', like).limit(10)
          : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;
      setResults({
        events: eventsRes.data ?? [],
        vendors: vendorsRes.data ?? [],
        products: (productsRes.data as typeof results.products) ?? [],
      });
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, filter, active]);

  useEffect(() => {
    let cancelled = false;
    async function loadSuggested() {
      setSuggestedLoading(true);
      try {
        const products = await fetchSuggestedProducts(
          shopper?.interests ?? [],
          { userCity: user?.city, userState: user?.state },
          8,
        );
        if (!cancelled) setSuggestedProducts(products);
      } catch {
        if (!cancelled) setSuggestedProducts([]);
      } finally {
        if (!cancelled) setSuggestedLoading(false);
      }
    }
    loadSuggested();
    return () => {
      cancelled = true;
    };
  }, [shopper?.interests, user?.city, user?.state]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeftovers() {
      setLeftoversLoading(true);
      try {
        const curated = await fetchCuratedLeftovers({
          userCity: user?.city,
          userState: user?.state,
        }, 6);
        if (!cancelled) setLeftovers(curated);
      } catch {
        if (!cancelled) setLeftovers([]);
      } finally {
        if (!cancelled) setLeftoversLoading(false);
      }
    }
    loadLeftovers();
    return () => {
      cancelled = true;
    };
  }, [user?.city, user?.state]);

  const total = results.events.length + results.vendors.length + results.products.length;

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Discover local</p>
      <h1 className="app-title">Search</h1>

      <input
        className="app-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events, vendors, products"
      />

      <div className="app-chip-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`app-chip${filter === f.key ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!active ? (
        <div className="app-list">
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem' }}>For you</h2>

            <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Suggested products</h3>
            {suggestedLoading ? (
              <div className="app-loading"><div className="app-spinner" /></div>
            ) : suggestedProducts.length === 0 ? (
              <p className="app-row-meta" style={{ marginBottom: '1.25rem' }}>
                No product matches yet for your interests — browse events to discover vendors.
              </p>
            ) : (
              <div className="app-list" style={{ marginBottom: '1.25rem' }}>
                {suggestedProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/shopper/products/${product.id}`}
                    className="app-card app-card--pressable app-row"
                  >
                    <DiscoverThumb
                      imageUrl={product.displayImageUrl}
                      category={product.category ?? product.matchedInterest}
                    />
                    <div className="app-row-body">
                      <p className="app-row-title">{product.name}</p>
                      <p className="app-row-meta">
                        {product.vendor?.business_name} · {formatPrice(product.price)}
                      </p>
                      <p className="app-row-meta" style={{ color: 'var(--color-forest)' }}>
                        {product.matchedInterest}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Leftovers near you</h3>
              <Link to="/shopper/leftovers" className="app-row-meta" style={{ fontWeight: 600, color: 'var(--color-forest)' }}>
                See all
              </Link>
            </div>
            {leftoversLoading ? (
              <div className="app-loading"><div className="app-spinner" /></div>
            ) : leftovers.length === 0 ? (
              <p className="app-row-meta">No active deals right now — check after market days.</p>
            ) : (
              <div className="app-list">
                {leftovers.slice(0, 4).map((listing) => (
                  <Link
                    key={listing.id}
                    to={`/shopper/leftovers/${listing.id}`}
                    className="app-card app-card--pressable app-row"
                  >
                    <DiscoverThumb
                      imageUrl={pickListingDisplayImage(listing.media_url)}
                      category={listing.vendor?.category ?? 'Food & Drink'}
                    />
                    <div className="app-row-body">
                      <p className="app-row-title">{listing.title}</p>
                      <p className="app-row-meta">
                        {listing.vendor?.business_name} · {formatPrice(listing.price_cents)}
                      </p>
                      <p className="app-row-meta" style={{ color: 'var(--color-warn)' }}>
                        {formatExpiresIn(listing.hoursLeft)} · {listing.quantity_remaining} left
                      </p>
                      <p className="app-row-meta">
                        {listing.locationLabel}
                        {listing.distanceMiles != null ? ` · ${formatDistance(listing.distanceMiles)}` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <p className="app-row-meta">Type at least 2 characters to search, or jump in:</p>
          <Link to="/shopper/events" className="app-card app-card--pressable">
            <h3 className="app-row-title">Browse events</h3>
            <p className="app-row-meta">Markets and pop-ups near you.</p>
          </Link>
          <Link to="/shopper/map" className="app-card app-card--pressable">
            <h3 className="app-row-title">Explore the map</h3>
            <p className="app-row-meta">See events around you.</p>
          </Link>
          <Link to="/shopper/leftovers" className="app-card app-card--pressable">
            <h3 className="app-row-title">Market leftovers</h3>
            <p className="app-row-meta">Rescue unsold goods sorted by time and distance.</p>
          </Link>
        </div>
      ) : loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : total === 0 ? (
        <div className="app-empty">No matches for &ldquo;{trimmed}&rdquo;</div>
      ) : (
        <div className="app-list">
          {results.events.map((event) => (
            <Link key={event.id} to={`/shopper/events/${event.id}`} className="app-card app-card--pressable app-row">
              <div className="app-row-icon">📅</div>
              <div className="app-row-body">
                <p className="app-row-title">{event.name}</p>
                <p className="app-row-meta">
                  {formatEventDate(event.start_datetime)}
                  {event.city ? ` · ${event.city}` : ''}
                </p>
              </div>
            </Link>
          ))}
          {results.vendors.map((vendor) => (
            <Link key={vendor.id} to={`/shopper/vendors/${vendor.id}`} className="app-card app-card--pressable app-row">
              <div className="app-row-icon">🏪</div>
              <div className="app-row-body">
                <p className="app-row-title">{vendor.business_name ?? 'Vendor'}</p>
                {vendor.category ? <p className="app-row-meta">{vendor.category}</p> : null}
              </div>
            </Link>
          ))}
          {results.products.map((product) => (
            <Link key={product.id} to={`/shopper/products/${product.id}`} className="app-card app-card--pressable app-row">
              <div className="app-row-icon">🛒</div>
              <div className="app-row-body">
                <p className="app-row-title">{product.name}</p>
                <p className="app-row-meta">
                  {formatPrice(product.price)}
                  {product.vendor?.business_name ? ` · ${product.vendor.business_name}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
