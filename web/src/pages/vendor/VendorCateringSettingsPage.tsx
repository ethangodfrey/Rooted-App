import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchCateringForVendor,
  upsertCateringForVendor,
} from '@/lib/vendor-catering';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';
import '@/components/vendor/catering-settings.css';

export function VendorCateringSettingsPage() {
  const { vendor, refreshUser } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [minGuests, setMinGuests] = useState(10);
  const [maxGuests, setMaxGuests] = useState(50);
  const [priceRange, setPriceRange] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    console.log('CATERING_MODULE_INITIALIZED SURFACE=VENDOR_SETTINGS');
  }, []);

  useEffect(() => {
    async function load() {
      if (!vendor?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (isApiConfigured) {
          const data = await fetchCateringForVendor(vendor.id);
          setEnabled(Boolean(data.IS_CATERING_PROVIDER));
          setDescription(data.SERVICE?.serviceDescription ?? '');
          setMinGuests(data.SERVICE?.minGuests ?? 10);
          setMaxGuests(data.SERVICE?.maxGuests ?? 50);
          setPriceRange(data.SERVICE?.priceRangeEstimate ?? '');
        } else {
          const { data: row } = await supabase
            .from('vendors')
            .select('is_catering_provider')
            .eq('id', vendor.id)
            .maybeSingle();
          setEnabled(Boolean(row?.is_catering_provider));
          const { data: service } = await supabase
            .from('vendor_catering_services')
            .select('*')
            .eq('vendor_id', vendor.id)
            .maybeSingle();
          if (service) {
            setDescription(service.service_description ?? '');
            setMinGuests(service.min_guests ?? 10);
            setMaxGuests(service.max_guests ?? 50);
            setPriceRange(service.price_range_estimate ?? '');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load catering settings.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [vendor?.id]);

  async function handleSave() {
    if (!vendor?.id) return;
    if (enabled && maxGuests < minGuests) {
      setError('Max guests must be greater than or equal to min guests.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (isApiConfigured) {
        await upsertCateringForVendor(vendor.id, {
          isCateringProvider: enabled,
          serviceDescription: description,
          minGuests,
          maxGuests,
          priceRangeEstimate: priceRange,
        });
      } else {
        const { error: vendorError } = await supabase
          .from('vendors')
          .update({ is_catering_provider: enabled })
          .eq('id', vendor.id);
        if (vendorError) throw new Error(vendorError.message);
        if (enabled) {
          const { error: serviceError } = await supabase
            .from('vendor_catering_services')
            .upsert(
              {
                vendor_id: vendor.id,
                service_description: description.trim(),
                min_guests: minGuests,
                max_guests: maxGuests,
                price_range_estimate: priceRange.trim() || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'vendor_id' },
            );
          if (serviceError) throw new Error(serviceError.message);
        }
      }
      console.log(
        `VENDOR_SERVICES_UPDATED VENDOR=${vendor.id} ENABLED=${enabled ? '1' : '0'} MIN_GUESTS=${minGuests} MAX_GUESTS=${maxGuests}`,
      );
      setSaved(true);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save catering settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <VendorScreen>
      <Link to="/vendor/profile" className="app-back-link">
        ← Profile
      </Link>
      <VendorHero eyebrow="Settings" title="Catering Settings" />
      <div className="mb-4">
        <Link to="/vendor/availability" className="app-btn app-btn--secondary app-btn--small">
          Availability Calendar
        </Link>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : (
        <VendorSection title="Availability">
          <VendorFormPanel>
            <label className="catering-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Available for catering</span>
            </label>

            {enabled ? (
              <>
                <div className="app-input-group">
                  <label>Service description</label>
                  <textarea
                    className="app-textarea"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Menus, dietary options, service style…"
                  />
                </div>
                <div className="catering-capacity-row">
                  <div className="app-input-group">
                    <label>Min guests</label>
                    <input
                      className="app-input"
                      type="number"
                      min={1}
                      value={minGuests}
                      onChange={(e) => setMinGuests(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="app-input-group">
                    <label>Max guests</label>
                    <input
                      className="app-input"
                      type="number"
                      min={1}
                      value={maxGuests}
                      onChange={(e) => setMaxGuests(Number(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="app-input-group">
                  <label>Price range estimate</label>
                  <input
                    className="app-input"
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    placeholder="e.g. $25–$45 per guest"
                  />
                </div>
              </>
            ) : null}

            {error ? <FieldError message={error} /> : null}
            {saved ? <p className="catering-saved">VENDOR_SERVICES_UPDATED</p> : null}

            <VendorPrimaryButton
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save catering settings'}
            </VendorPrimaryButton>
          </VendorFormPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
