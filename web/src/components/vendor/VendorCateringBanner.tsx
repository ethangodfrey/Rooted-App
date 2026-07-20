import { useEffect, useState } from 'react';

import { RequestCateringButton } from '@/components/vendor/RequestCateringButton';
import { isApiConfigured } from '@/lib/api';
import {
  fetchCateringForVendor,
  type CateringVendorResponse,
} from '@/lib/vendor-catering';
import { supabase } from '@/lib/supabase';
import '@/components/vendor/catering-settings.css';

type VendorCateringBannerProps = {
  vendorId: string;
  vendorName?: string | null;
};

/**
 * Prominently shows catering availability on the public vendor profile.
 */
export function VendorCateringBanner({
  vendorId,
  vendorName,
}: VendorCateringBannerProps) {
  const [data, setData] = useState<CateringVendorResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isApiConfigured) {
          const res = await fetchCateringForVendor(vendorId);
          if (!cancelled) setData(res);
          return;
        }
        const { data: vendor } = await supabase
          .from('vendors')
          .select('is_catering_provider, business_name')
          .eq('id', vendorId)
          .maybeSingle();
        if (!vendor?.is_catering_provider) {
          if (!cancelled) setData(null);
          return;
        }
        const { data: service } = await supabase
          .from('vendor_catering_services')
          .select('*')
          .eq('vendor_id', vendorId)
          .maybeSingle();
        if (!cancelled) {
          setData({
            STATUS: 'CATERING_MODULE_INITIALIZED',
            VENDOR_ID: vendorId,
            BUSINESS_NAME: vendor.business_name ?? null,
            IS_CATERING_PROVIDER: true,
            SERVICE: service
              ? {
                  serviceDescription: service.service_description ?? '',
                  minGuests: service.min_guests ?? 1,
                  maxGuests: service.max_guests ?? 1,
                  priceRangeEstimate: service.price_range_estimate ?? null,
                }
              : null,
          });
        }
      } catch {
        if (!cancelled) setData(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!data?.IS_CATERING_PROVIDER) return null;

  const service = data.SERVICE;

  return (
    <aside className="catering-public-banner" aria-label="Catering availability">
      <p className="catering-public-banner__label">Available for catering</p>
      <p className="catering-public-banner__title">
        {service?.serviceDescription?.trim() || 'Private events and group catering'}
      </p>
      <p className="catering-public-banner__meta">
        {[
          service
            ? `${service.minGuests}–${service.maxGuests} guests`
            : null,
          service?.priceRangeEstimate,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <RequestCateringButton vendorId={vendorId} vendorName={vendorName} />
    </aside>
  );
}
