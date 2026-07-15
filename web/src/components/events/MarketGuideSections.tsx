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
    <div className="mb-6 flex flex-col gap-4">
      {event.what_to_look_for ? (
        <div className="app-card">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">What to look for</h2>
          <p className="text-sm leading-relaxed text-stone-600 sm:text-base">{event.what_to_look_for}</p>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div className="app-card">
          <h2 className="mb-3 text-lg font-semibold text-stone-900">What you&apos;ll find</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {event.market_highlights ? (
        <div className="app-card">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Highlights & news</h2>
          <p className="text-sm leading-relaxed text-stone-600 sm:text-base">{event.market_highlights}</p>
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="app-card">
          <h2 className="mb-3 text-lg font-semibold text-stone-900">Shopper tips</h2>
          <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-600 sm:text-base">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
