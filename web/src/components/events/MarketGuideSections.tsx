import {
  getFeaturedVendorCategories,
  getShopperTips,
  hasMarketGuide,
} from '@/lib/market-guide';
import type { Event } from '@/types/database';

interface MarketGuideSectionsProps {
  event: Event;
}

export function MarketGuideSections({ event }: MarketGuideSectionsProps) {
  if (!hasMarketGuide(event)) return null;

  const categories = getFeaturedVendorCategories(event);
  const tips = getShopperTips(event);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {event.what_to_look_for ? (
        <div className="app-card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>What to look for</h2>
          <p style={{ lineHeight: 1.6 }}>{event.what_to_look_for}</p>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div className="app-card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>What you&apos;ll find</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {categories.map((category) => (
              <span
                key={category}
                style={{
                  background: 'var(--color-honeydew, #f0f7f0)',
                  borderRadius: '999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                }}
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {event.market_highlights ? (
        <div className="app-card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Highlights & news</h2>
          <p style={{ lineHeight: 1.6 }}>{event.market_highlights}</p>
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="app-card">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Shopper tips</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            {tips.map((tip) => (
              <li key={tip} style={{ marginBottom: '0.35rem' }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
