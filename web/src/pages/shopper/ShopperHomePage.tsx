import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';

import { useNow } from '@/hooks/use-now';

import { useUserCoords } from '@/hooks/use-user-coords';

import { eventRuntimePhase, eventRuntimeHint, type EventRuntimeFields } from '@/lib/event-runtime';

import { formatEventDate, formatPrice } from '@/lib/format';
import { fetchNearbyEvents, formatDistanceKm, type NearbyEvent } from '@/lib/geo-search';

import { fetchCuratedLeftovers, formatExpiresIn, type CuratedLeftover } from '@/lib/leftovers';
import { getMarketContext } from '@/lib/market-context';
import { fetchSuggestedProducts, type SuggestedProduct } from '@/lib/suggested-products';

import '@/components/ui/ui.css';



function SkeletonTiles({ count = 3 }: { count?: number }) {

  return (

    <div className="app-hscroll">

      {Array.from({ length: count }, (_, i) => (

        <div key={i} className="app-skeleton app-skeleton--tile" />

      ))}

    </div>

  );

}



export function ShopperHomePage() {

  const { user, shopper } = useAuth();

  const { coords } = useUserCoords();

  const now = useNow(60_000);

  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);

  const [suggestedLoading, setSuggestedLoading] = useState(true);

  const [leftovers, setLeftovers] = useState<CuratedLeftover[]>([]);

  const [leftoversLoading, setLeftoversLoading] = useState(true);

  const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);

  const [nearbyLoading, setNearbyLoading] = useState(false);



  const context = useMemo(

    () => getMarketContext(now, user?.name),

    [now, user?.name],

  );



  const lat = coords?.latitude ?? null;

  const lng = coords?.longitude ?? null;

  const nearbyCoords = useMemo(

    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),

    [lat, lng],

  );



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

        const curated = await fetchCuratedLeftovers(

          { coords: nearbyCoords, userCity: user?.city, userState: user?.state },

          6,

        );

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

  }, [nearbyCoords, user?.city, user?.state]);



  useEffect(() => {

    if (!nearbyCoords) {

      setNearbyEvents([]);

      return;

    }



    let cancelled = false;

    setNearbyLoading(true);

    void fetchNearbyEvents(nearbyCoords, { limit: 12 }).then((events) => {

      if (cancelled) return;

      setNearbyEvents(events ?? []);

      setNearbyLoading(false);

    });



    return () => {

      cancelled = true;

    };

  }, [nearbyCoords]);



  const openNow = useMemo(
    () => nearbyEvents.filter((e) => eventRuntimePhase(e as EventRuntimeFields, now) === 'live'),
    [nearbyEvents, now],
  );

  const nextOpeningHint = useMemo(() => {
    const upcoming = nearbyEvents
      .filter((e) => eventRuntimePhase(e as EventRuntimeFields, now) === 'upcoming')
      .map((e) => ({ event: e, hint: eventRuntimeHint(e as EventRuntimeFields, now) }))
      .filter((item) => item.hint);
    return upcoming[0]?.hint ?? null;
  }, [nearbyEvents, now]);



  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const newThisWeek = useMemo(
    () => nearbyEvents.filter((e) => new Date(e.start_datetime).getTime() >= weekAgo),
    [nearbyEvents, weekAgo],
  );



  return (

    <div className="app-screen">

      <header className="app-greeting">

        <h1 className="app-greeting__title">{context.greeting}</h1>

        <p className="app-greeting__subtitle">{context.subtitle}</p>

      </header>



      <Link
        to={context.isMarketDay ? '/shopper/map' : '/shopper/events'}
        className={`app-hero-card${context.isMarketDay ? ' app-hero-card--market-day' : ''}`}
      >
        <div className="app-hero-card__content">
          <p className="app-hero-card__eyebrow">
            {context.isMarketDay ? 'Market day' : 'Discover local'}
          </p>
          <p className="app-hero-card__title">
            {context.isMarketDay
              ? 'Weekend markets are open near you'
              : 'Your neighborhood food scene'}
          </p>
          <p className="app-hero-card__body">
            {context.isMarketDay
              ? "See what's happening on the map — pins show live and upcoming markets."
              : 'Browse farmers markets, reserve pickup, and support local vendors.'}
          </p>
        </div>
        <span className="app-hero-card__chevron" aria-hidden="true">
          ›
        </span>
      </Link>



      {nearbyCoords ? (

        <section className="app-scroll-section">

          <div className="app-scroll-section__header">

            <h2 className="app-scroll-section__title">Open now</h2>

            <Link to="/shopper/map" className="app-inline-link">

              Map

            </Link>

          </div>

          {nearbyLoading ? (

            <SkeletonTiles />

          ) : openNow.length === 0 ? (
            <p className="app-row-meta">
              {nextOpeningHint ?? 'No markets open right now — check upcoming below.'}
            </p>
          ) : (

            <div className="app-hscroll">

              {openNow.map((event) => (

                <Link key={event.id} to={`/shopper/events/${event.id}`} className="app-hscroll-card">
                  <div className="app-hscroll-card__visual" aria-hidden="true">
                    🧺
                  </div>
                  <div className="app-hscroll-card__body">
                    <span className="app-hscroll-card__badge">Live</span>
                    <p className="app-hscroll-card__title">{event.name}</p>
                    <p className="app-hscroll-card__meta">
                      {event.city ?? ''}
                      {formatDistanceKm(event.distance_km) ? ` · ${formatDistanceKm(event.distance_km)}` : ''}
                    </p>
                  </div>
                </Link>

              ))}

            </div>

          )}

        </section>

      ) : null}



      <section className="app-scroll-section">

        <div className="app-scroll-section__header">

          <h2 className="app-scroll-section__title">New this week</h2>

          <Link to="/shopper/events" className="app-inline-link">

            All markets

          </Link>

        </div>

        {nearbyLoading && nearbyCoords ? (

          <SkeletonTiles />

        ) : newThisWeek.length > 0 ? (

          <div className="app-hscroll">

            {newThisWeek.slice(0, 8).map((event) => (

              <Link key={event.id} to={`/shopper/events/${event.id}`} className="app-hscroll-card">
                <div className="app-hscroll-card__visual" aria-hidden="true">
                  🌿
                </div>
                <div className="app-hscroll-card__body">
                  <p className="app-hscroll-card__title">{event.name}</p>
                  <p className="app-hscroll-card__meta">{formatEventDate(event.start_datetime)}</p>
                </div>
              </Link>

            ))}

          </div>

        ) : suggestedLoading ? (

          <SkeletonTiles />

        ) : suggestedProducts.length > 0 ? (

          <div className="app-hscroll">

            {suggestedProducts.slice(0, 6).map((product) => (

              <Link

                key={product.id}

                to={`/shopper/products/${product.id}`}

                className="app-hscroll-card"

              >

                <p className="app-hscroll-card__title">{product.name}</p>

                <p className="app-hscroll-card__meta">

                  {product.vendor?.business_name} · {formatPrice(product.price)}

                </p>

              </Link>

            ))}

          </div>

        ) : (

          <p className="app-row-meta">Fresh picks will appear as vendors and markets update.</p>

        )}

      </section>



      <section className="app-scroll-section">

        <div className="app-scroll-section__header">

          <h2 className="app-scroll-section__title">Updates</h2>

          <Link to="/shopper/feed" className="app-inline-link">

            See all

          </Link>

        </div>

        <Link to="/shopper/feed" className="app-hscroll-card" style={{ display: 'block', maxWidth: '100%' }}>

          <p className="app-hscroll-card__title">From your saved vendors</p>

          <p className="app-hscroll-card__meta">

            Postcards from markets, new products, and vendor news.

          </p>

        </Link>

      </section>



      {!leftoversLoading && leftovers.length > 0 ? (

        <section className="app-scroll-section">

          <div className="app-scroll-section__header">

            <h2 className="app-scroll-section__title">Leftovers near you</h2>

            <Link to="/shopper/leftovers" className="app-inline-link">

              See all

            </Link>

          </div>

          <div className="app-hscroll">

            {leftovers.slice(0, 5).map((listing) => (

              <Link

                key={listing.id}

                to={`/shopper/leftovers/${listing.id}`}

                className="app-hscroll-card"

              >

                <p className="app-hscroll-card__title">{listing.title}</p>

                <p className="app-hscroll-card__meta">

                  {formatPrice(listing.price_cents)} · {formatExpiresIn(listing.hoursLeft)}

                </p>

              </Link>

            ))}

          </div>

        </section>

      ) : null}



      <Link to="/shopper/search" className="app-search-link app-search--glass" style={{ marginTop: '0.5rem' }}>

        Search markets, vendors, chefs…

      </Link>

    </div>

  );

}

