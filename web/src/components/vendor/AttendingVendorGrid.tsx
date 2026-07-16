import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import type { MarketAttendingVendor } from '@/hooks/use-market-detail';
import { flashSaleBadgeText, parseFlashSale } from '@/lib/flash-sale';
import { vendorPath } from '@/lib/market-routes';
import { coordsFrom, distanceMiles, formatDistance, isValidCoords, type Coords } from '@/lib/geo';

interface AttendingVendorGridProps {
  vendors: MarketAttendingVendor[];
  userCoords: Coords | null;
  marketId: string;
}

function vendorDistanceLabel(vendor: MarketAttendingVendor, userCoords: Coords | null): string | null {
  if (!userCoords) return null;
  const vendorCoords = coordsFrom({ latitude: vendor.latitude, longitude: vendor.longitude });
  if (!vendorCoords) return null;
  return formatDistance(distanceMiles(userCoords, vendorCoords));
}

export function AttendingVendorGrid({ vendors, userCoords, marketId }: AttendingVendorGridProps) {
  if (vendors.length === 0) {
    return (
      <p className="app-row-meta rounded-xl border border-zinc-200/50 bg-white/80 px-4 py-6 text-center backdrop-blur-md">
        No Vendorly vendors are linked to this market yet. Vendors can join from their dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
      {vendors.map((vendor) => {
        const distance = isValidCoords(userCoords)
          ? vendorDistanceLabel(vendor, userCoords)
          : null;
        const flash = parseFlashSale(vendor.theme_settings ?? null);
        const highlight =
          typeof vendor.theme_settings?.featured_highlight === 'string'
            ? vendor.theme_settings.featured_highlight.trim()
            : '';
        const badge = highlight || (flash ? flashSaleBadgeText(flash.unitsLeft) : null);

        return (
          <Link
            key={vendor.id}
            to={vendorPath(vendor.id, marketId)}
            className="app-card app-card--pressable flex flex-row items-center gap-3 p-3 transition"
          >
            <FallbackImage
              src={vendor.logo_url}
              variant="vendor-logo"
              category={vendor.category}
              style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0 }}
            />
            <div className="min-w-0 flex-1">
              <p className="app-row-title truncate">{vendor.business_name ?? 'Vendor'}</p>
              {vendor.category ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">
                  {vendor.category}
                </p>
              ) : null}
              {badge ? (
                <span className="mt-1 inline-flex max-w-full items-center rounded-md border border-amber-400/40 bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0B1228]">
                  <span className="truncate">{badge}</span>
                </span>
              ) : null}
              {vendor.product_summary ? (
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-zinc-500">
                  {vendor.product_summary}
                </p>
              ) : null}
              {distance ? (
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 tabular-nums">
                  {distance} away
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
