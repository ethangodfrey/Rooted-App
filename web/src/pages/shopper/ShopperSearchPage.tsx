import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { DiscoverBrowseFeed } from '@/components/discover/DiscoverBrowseFeed';
import { useAuth } from '@/hooks/use-auth';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { useUserCoords } from '@/hooks/use-user-coords';
import { fetchDiscoverFeed, type DiscoverFeedData } from '@/lib/discover-feed';
import {
  formatDistanceKm,
  runUnifiedSearch,
  unifiedSearchTotal,
  type UnifiedSearchFilter,
  type UnifiedSearchResults,
} from '@/lib/unified-search';

import { formatEventDate, formatPrice } from '@/lib/format';
import { pushRecentSearch, readRecentSearches } from '@/lib/recent-searches';

import '@/components/ui/ui.css';

const FILTERS: { key: UnifiedSearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Markets' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'chefs', label: 'Chefs' },
  { key: 'products', label: 'Products' },
];

const EMPTY_RESULTS: UnifiedSearchResults = {
  events: [],
  vendors: [],
  chefs: [],
  products: [],
  services: [],
  leftovers: [],
};

export function ShopperSearchPage() {
  const { user, shopper } = useAuth();
  const { saved } = useSavedVendors();
  const { coords } = useUserCoords();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UnifiedSearchFilter>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UnifiedSearchResults>(EMPTY_RESULTS);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [discover, setDiscover] = useState<DiscoverFeedData | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(true);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  const lat = coords?.latitude ?? null;
  const lng = coords?.longitude ?? null;
  const searchCoords = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  useEffect(() => {
    if (active) return;

    let cancelled = false;
    setDiscoverLoading(true);

    void fetchDiscoverFeed({
      coords: searchCoords,
      userCity: user?.city,
      userState: user?.state,
      interests: shopper?.interests ?? [],
      savedVendorIds: saved,
    }).then((feed) => {
      if (!cancelled) {
        setDiscover(feed);
        setDiscoverLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [active, searchCoords, user?.city, user?.state, shopper?.interests, saved]);

  useEffect(() => {
    if (!active) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const data = await runUnifiedSearch(trimmed, filter, searchCoords);
      if (cancelled) return;
      setResults(data);
      setLoading(false);
      if (unifiedSearchTotal(data) > 0) {
        pushRecentSearch(trimmed);
        setRecentSearches(readRecentSearches());
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, filter, active, searchCoords]);

  const total = unifiedSearchTotal(results);

  return (
    <div className="app-screen app-screen--titled">
      <input
        className="app-search app-search--glass"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search markets, vendors, chefs, products…"
      />

      {active ? (
        <div className="app-chip-row app-chip-row--after-query">
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
      ) : null}

      {!active ? (
        <>
          <section className="app-recent-searches" aria-label="Recent searches">
            <h2 className="app-recent-searches__title">Recent searches</h2>
            {recentSearches.length === 0 ? (
              <p className="app-recent-searches__empty">Your recent searches will appear here.</p>
            ) : (
              <div>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="app-recent-chip"
                    onClick={() => setQuery(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </section>

          <DiscoverBrowseFeed data={discover} loading={discoverLoading} />
        </>
      ) : loading ? (
        <div className="app-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="app-skeleton app-skeleton--card" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="app-empty app-empty--warm">
          <div className="app-empty--warm__icon" aria-hidden="true">
            🔍
          </div>
          <p className="app-row-title" style={{ marginBottom: '0.5rem' }}>
            No results for &ldquo;{trimmed}&rdquo;
          </p>
          <p className="app-row-meta">
            Try a different spelling, or browse{' '}
            <Link to="/shopper/chefs" className="app-inline-link">
              private chefs
            </Link>{' '}
            and local vendors.
          </p>
        </div>
      ) : (
        <div className="app-list">
          {results.events.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Markets</h2>
              {results.events.map((event) => (
                <Link
                  key={event.id}
                  to={`/shopper/events/${event.id}`}
                  className="app-card app-card--pressable app-row"
                >
                  <div className="app-row-icon">📅</div>
                  <div className="app-row-body">
                    <p className="app-row-title">{event.name}</p>
                    <p className="app-row-meta">
                      {formatEventDate(event.start_datetime)}
                      {event.city ? ` · ${event.city}` : ''}
                      {formatDistanceKm(event.distance_km) ? ` · ${formatDistanceKm(event.distance_km)}` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          ) : null}

          {results.vendors.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Vendors</h2>
              {results.vendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  to={`/shopper/vendors/${vendor.id}`}
                  className="app-card app-card--pressable app-row"
                >
                  <div className="app-row-icon">🏪</div>
                  <div className="app-row-body">
                    <p className="app-row-title">{vendor.business_name ?? 'Vendor'}</p>
                    {vendor.category || formatDistanceKm(vendor.distance_km) ? (
                      <p className="app-row-meta">
                        {[vendor.category, formatDistanceKm(vendor.distance_km)].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </section>
          ) : null}

          {results.chefs.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Chefs</h2>
              {results.chefs.map((chef) => (
                <Link
                  key={chef.id}
                  to={`/shopper/chefs/${chef.id}`}
                  className="app-card app-card--pressable app-row"
                >
                  <div className="app-row-icon">👨‍🍳</div>
                  <div className="app-row-body">
                    <p className="app-row-title">{chef.display_name}</p>
                    {[chef.home_base_city, chef.home_base_state].filter(Boolean).length > 0 ? (
                      <p className="app-row-meta">
                        {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </section>
          ) : null}

          {results.services.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Chef services</h2>
              {results.services.map((service) => (
                <Link
                  key={service.id}
                  to={`/shopper/chefs/book/${service.id}`}
                  className="app-card app-card--pressable app-row"
                >
                  <div className="app-row-icon">🍽️</div>
                  <div className="app-row-body">
                    <p className="app-row-title">{service.service_name}</p>
                    <p className="app-row-meta">
                      {service.chef?.display_name ?? 'Chef'} · {formatPrice(service.base_price)}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          ) : null}

          {results.products.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Products</h2>
              {results.products.map((product) => (
                <Link
                  key={product.id}
                  to={`/shopper/products/${product.id}`}
                  className="app-card app-card--pressable app-row"
                >
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
            </section>
          ) : null}

          {results.leftovers.length > 0 ? (
            <section>
              <h2 className="app-section-heading">Leftovers</h2>
              {results.leftovers.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/shopper/leftovers/${listing.id}`}
                  className="app-card app-card--pressable app-row"
                >
                  <div className="app-row-icon">♻️</div>
                  <div className="app-row-body">
                    <p className="app-row-title">{listing.title}</p>
                    <p className="app-row-meta">
                      {[
                        listing.vendor_name,
                        listing.price_cents != null ? formatPrice(listing.price_cents) : null,
                        formatDistanceKm(listing.distance_km),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
