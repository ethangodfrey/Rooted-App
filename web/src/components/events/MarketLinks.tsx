import type { Event } from '@/types/database';

import { extractMarketLinks, linkDisplayLabel } from '@/lib/market-links';

interface MarketLinksProps {
  event: Pick<Event, 'website_url' | 'extra_info' | 'sync_metadata'>;
}

export function MarketLinks({ event }: MarketLinksProps) {
  const links = extractMarketLinks(event);
  const items = [
    links.website ? { href: links.website, label: 'Visit website', detail: linkDisplayLabel(links.website) } : null,
    links.facebook ? { href: links.facebook, label: 'Facebook', detail: linkDisplayLabel(links.facebook) } : null,
    links.instagram ? { href: links.instagram, label: 'Instagram', detail: linkDisplayLabel(links.instagram) } : null,
  ].filter(Boolean) as { href: string; label: string; detail: string }[];

  if (items.length === 0) return null;

  return (
    <div className="market-links" style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="app-btn app-btn--secondary app-btn--small"
          style={{ textDecoration: 'none' }}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
