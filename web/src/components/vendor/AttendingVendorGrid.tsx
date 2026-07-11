import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import type { MarketAttendingVendor } from '@/hooks/use-market-detail';
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
      <p className="app-row-meta rounded-2xl bg-slate-50 px-4 py-6 text-center">
        No Vendorly vendors are linked to this market yet. Vendors can join from their dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {vendors.map((vendor) => {
        const distance = isValidCoords(userCoords)
          ? vendorDistanceLabel(vendor, userCoords)
          : null;

        return (
          <Link
            key={vendor.id}
            to={vendorPath(vendor.id, marketId)}
            className="app-card app-card--pressable flex flex-row items-center gap-3 p-3 transition hover:shadow-md"
          >
            <FallbackImage
              src={vendor.logo_url}
              variant="vendor-logo"
              category={vendor.category}
              style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }}
            />
            <div className="min-w-0 flex-1">
              <p className="app-row-title truncate">{vendor.business_name ?? 'Vendor'}</p>
              {vendor.category ? (
                <p className="app-row-meta truncate">{vendor.category}</p>
              ) : null}
              {vendor.product_summary ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{vendor.product_summary}</p>
              ) : null}
              {distance ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">{distance} away</p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
