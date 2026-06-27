import { Link } from 'react-router-dom';



import { categoryVisual } from '@/lib/category-visuals';

import { formatEventDate, formatPrice, formatRelativeTime } from '@/lib/format';

import { formatDistanceKm } from '@/lib/geo-search';

import type { DiscoverFeedData } from '@/lib/discover-feed';

import { formatExpiresIn } from '@/lib/leftovers';

import { POST_TYPE_ICON, POST_TYPE_LABEL } from '@/lib/post-type';

import type { PopularProduct, SuggestedProduct } from '@/lib/suggested-products';

import type { FeedPost } from '@/types/database';



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



function productCategory(product: PopularProduct | SuggestedProduct): string | null {

  if ('matchedInterest' in product) return product.category ?? product.matchedInterest;

  return product.category;

}



function ProductVisual({ product }: { product: PopularProduct | SuggestedProduct }) {

  const visual = categoryVisual(productCategory(product));

  if (product.displayImageUrl) {

    return <img src={product.displayImageUrl} alt="" />;

  }

  return <span aria-hidden="true">{visual.emoji}</span>;

}



function DiscoverPostCard({ post }: { post: FeedPost }) {

  const thumbUrl =

    post.media_type === 'video' ? post.video_thumbnail_url ?? post.media_url : post.media_url;



  return (

    <article className="app-postcard app-postcard--compact">

      <div className="app-row" style={{ marginBottom: '0.375rem' }}>

        <span>{POST_TYPE_ICON[post.post_type]}</span>

        <span className="app-status">{POST_TYPE_LABEL[post.post_type]}</span>

        <span className="app-row-meta">{formatRelativeTime(post.publish_at)}</span>

      </div>

      {post.vendor ? (

        <Link to={`/shopper/vendors/${post.vendor_id}`} style={{ fontWeight: 600, color: 'var(--color-primary)' }}>

          {post.vendor.business_name ?? 'Vendor'}

        </Link>

      ) : null}

      <p className="app-postcard__caption">{post.caption}</p>

      {post.product ? (

        <Link to={`/shopper/products/${post.product.id}`} className="app-row-meta">

          → {post.product.name}

        </Link>

      ) : null}

      {post.event ? (

        <Link to={`/shopper/events/${post.event.id}`} className="app-row-meta">

          → {post.event.name}

        </Link>

      ) : null}

      {thumbUrl ? (

        <img src={thumbUrl} alt="" className="app-postcard__media" />

      ) : null}

    </article>

  );

}



interface DiscoverBrowseFeedProps {

  data: DiscoverFeedData | null;

  loading: boolean;

}



export function DiscoverBrowseFeed({ data, loading }: DiscoverBrowseFeedProps) {

  if (loading && !data) {

    return (

      <div className="app-discover-feed">

        <section className="app-scroll-section">

          <div className="app-skeleton app-skeleton--heading" style={{ width: '45%', marginBottom: '0.75rem' }} />

          {Array.from({ length: 2 }, (_, i) => (

            <div key={i} className="app-skeleton app-skeleton--card" style={{ height: 120, marginBottom: '0.75rem' }} />

          ))}

        </section>

        <section className="app-scroll-section">

          <div className="app-skeleton app-skeleton--heading" style={{ width: '40%', marginBottom: '0.75rem' }} />

          <SkeletonTiles />

        </section>

        <section className="app-scroll-section">

          <div className="app-skeleton app-skeleton--heading" style={{ width: '35%', marginBottom: '0.75rem' }} />

          <SkeletonTiles />

        </section>

      </div>

    );

  }



  if (!data) return null;



  const { posts, postsFocus, markets, vendors, chefs, products, leftovers } = data;

  const postsTitle = postsFocus === 'saved' ? 'From vendors you follow' : 'Fresh updates';

  const hasBrowseMore =

    markets.length > 0 || vendors.length > 0 || chefs.length > 0 || leftovers.length > 0;

  const hasPrimary = posts.length > 0 || products.length > 0;



  if (!hasPrimary && !hasBrowseMore) {

    return (

      <p className="app-row-meta" style={{ marginTop: '0.5rem' }}>

        Local picks will appear as markets, vendors, and chefs join Vendorly near you.

      </p>

    );

  }



  return (

    <div className="app-discover-feed">

      <section className="app-scroll-section app-discover-primary">

        <div className="app-scroll-section__header">

          <h2 className="app-scroll-section__title">{postsTitle}</h2>

          <Link to="/shopper/feed" className="app-inline-link">

            See all

          </Link>

        </div>

        {posts.length > 0 ? (

          <div className="app-discover-posts">

            {posts.slice(0, 4).map((post) => (

              <DiscoverPostCard key={post.id} post={post} />

            ))}

          </div>

        ) : (

          <div className="app-empty app-empty--warm app-empty--inline">

            <div className="app-empty--warm__icon" aria-hidden="true">

              📮

            </div>

            <p className="app-row-title" style={{ marginBottom: '0.25rem' }}>

              No updates yet

            </p>

            <p className="app-row-meta">

              Save vendors to see their postcards here, or check back after market days.

            </p>

          </div>

        )}

      </section>



      {products.length > 0 ? (

        <section className="app-scroll-section app-discover-primary">

          <div className="app-scroll-section__header">

            <h2 className="app-scroll-section__title">Popular products</h2>

          </div>

          <div className="app-hscroll">

            {products.slice(0, 10).map((product) => (

              <Link

                key={product.id}

                to={`/shopper/products/${product.id}`}

                className="app-hscroll-card app-hscroll-card--product"

              >

                <div className="app-hscroll-card__visual app-hscroll-card__visual--product">

                  <ProductVisual product={product} />

                </div>

                <div className="app-hscroll-card__body">

                  <p className="app-hscroll-card__title">{product.name}</p>

                  <p className="app-hscroll-card__meta">

                    {product.vendor?.business_name ?? 'Vendor'} · {formatPrice(product.price)}

                  </p>

                </div>

              </Link>

            ))}

          </div>

        </section>

      ) : null}



      {hasBrowseMore ? (

        <>

          <h2 className="app-discover-browse-heading">Browse more</h2>



          {markets.length > 0 ? (

            <section className="app-scroll-section">

              <div className="app-scroll-section__header">

                <h2 className="app-scroll-section__title">Markets</h2>

                <Link to="/shopper/events" className="app-inline-link">

                  See all

                </Link>

              </div>

              <div className="app-hscroll">

                {markets.slice(0, 10).map((event) => (

                  <Link key={event.id} to={`/shopper/events/${event.id}`} className="app-hscroll-card">

                    <div className="app-hscroll-card__visual" aria-hidden="true">

                      🧺

                    </div>

                    <div className="app-hscroll-card__body">

                      <p className="app-hscroll-card__title">{event.name}</p>

                      <p className="app-hscroll-card__meta">

                        {formatEventDate(event.start_datetime)}

                        {event.city ? ` · ${event.city}` : ''}

                        {formatDistanceKm(event.distance_km) ? ` · ${formatDistanceKm(event.distance_km)}` : ''}

                      </p>

                    </div>

                  </Link>

                ))}

              </div>

            </section>

          ) : null}



          {vendors.length > 0 ? (

            <section className="app-scroll-section">

              <div className="app-scroll-section__header">

                <h2 className="app-scroll-section__title">Local businesses</h2>

              </div>

              <div className="app-hscroll">

                {vendors.slice(0, 8).map((vendor) => (

                  <Link key={vendor.id} to={`/shopper/vendors/${vendor.id}`} className="app-hscroll-card">

                    <div className="app-hscroll-card__visual" aria-hidden="true">

                      🏪

                    </div>

                    <div className="app-hscroll-card__body">

                      <p className="app-hscroll-card__title">{vendor.business_name ?? 'Vendor'}</p>

                      <p className="app-hscroll-card__meta">

                        {[vendor.category, formatDistanceKm(vendor.distance_km)].filter(Boolean).join(' · ') ||

                          [vendor.sell_city, vendor.sell_state].filter(Boolean).join(', ') ||

                          'Local vendor'}

                      </p>

                    </div>

                  </Link>

                ))}

              </div>

            </section>

          ) : null}



          {chefs.length > 0 ? (

            <section className="app-scroll-section">

              <div className="app-scroll-section__header">

                <h2 className="app-scroll-section__title">Private chefs</h2>

                <Link to="/shopper/chefs" className="app-inline-link">

                  See all

                </Link>

              </div>

              <div className="app-hscroll">

                {chefs.slice(0, 8).map((chef) => (

                  <Link key={chef.id} to={`/shopper/chefs/${chef.id}`} className="app-hscroll-card">

                    <div className="app-hscroll-card__visual" aria-hidden="true">

                      👨‍🍳

                    </div>

                    <div className="app-hscroll-card__body">

                      {chef.featured ? <span className="app-hscroll-card__badge">Featured</span> : null}

                      <p className="app-hscroll-card__title">{chef.display_name}</p>

                      <p className="app-hscroll-card__meta">

                        {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ') ||

                          'Private chef'}

                      </p>

                    </div>

                  </Link>

                ))}

              </div>

            </section>

          ) : null}



          {leftovers.length > 0 ? (

            <section className="app-scroll-section">

              <div className="app-scroll-section__header">

                <h2 className="app-scroll-section__title">Leftovers near you</h2>

                <Link to="/shopper/leftovers" className="app-inline-link">

                  See all

                </Link>

              </div>

              <div className="app-hscroll">

                {leftovers.slice(0, 6).map((listing) => (

                  <Link key={listing.id} to={`/shopper/leftovers/${listing.id}`} className="app-hscroll-card">

                    <div className="app-hscroll-card__visual" aria-hidden="true">

                      ♻️

                    </div>

                    <div className="app-hscroll-card__body">

                      <p className="app-hscroll-card__title">{listing.title}</p>

                      <p className="app-hscroll-card__meta">

                        {formatPrice(listing.price_cents)} · {formatExpiresIn(listing.hoursLeft)}

                      </p>

                    </div>

                  </Link>

                ))}

              </div>

            </section>

          ) : null}

        </>

      ) : null}

    </div>

  );

}


