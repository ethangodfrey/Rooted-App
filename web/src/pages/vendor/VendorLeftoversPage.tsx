import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorActionGrid,
  VendorActionTile,
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorSecondaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { formatExpiresIn, type LeftoverListing } from '@/lib/leftovers';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import '@/components/ui/ui.css';

export function VendorLeftoversPage() {
  const { vendor } = useAuth();
  const [listings, setListings] = useState<LeftoverListing[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('leftover_listings')
      .select('id, title, price_cents, quantity_remaining, expires_at, status, created_at')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setListings((data as LeftoverListing[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [vendor]);

  async function cancelListing(id: string) {
    await supabase
      .from('leftover_listings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  }

  return (
    <VendorScreen>
      <VendorHero eyebrow="Post-market" title="Leftovers" pill={loading ? undefined : `${listings.length} listed`} />

      <VendorActionGrid>
        <VendorActionTile
          to="/vendor/leftovers/new"
          title="List leftovers"
          subtitle="Post unsold items"
          icon="recycle"
          tone="rose"
        />
      </VendorActionGrid>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : listings.length === 0 ? (
        <VendorEmpty message="No leftovers listed yet." />
      ) : (
        <VendorSection title="Active listings">
          <VendorListPanel>
            {listings.map((listing) => {
              const hoursLeft = Math.max(
                0,
                (new Date(listing.expires_at).getTime() - Date.now()) / (1000 * 60 * 60),
              );
              return (
                <div key={listing.id} className="p-3.5">
                  <div className="flex items-start gap-3">
                    <IconBadge name="recycle" tone="rose" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-semibold text-stone-800">{listing.title}</p>
                      <p className="m-0 mt-0.5 text-xs text-stone-500">
                        {formatPrice(listing.price_cents)} · {listing.quantity_remaining} left ·{' '}
                        {listing.status}
                        {listing.status === 'active' ? ` · ${formatExpiresIn(hoursLeft)}` : ''}
                      </p>
                    </div>
                  </div>
                  {listing.status === 'active' ? (
                    <VendorSecondaryButton
                      className="mt-2"
                      onClick={() => void cancelListing(listing.id)}
                    >
                      Cancel listing
                    </VendorSecondaryButton>
                  ) : null}
                </div>
              );
            })}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
