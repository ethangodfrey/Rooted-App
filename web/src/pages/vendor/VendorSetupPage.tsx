import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { geocodeAddress } from '@/lib/geocode';
import { resetRoleSelection } from '@/lib/reset-role-selection';
import { supabase } from '@/lib/supabase';
import {
  normalizeUrl,
  SELLING_CHANNEL_OPTIONS,
  validateVendorApplication,
  VENDOR_CATEGORY_OPTIONS,
  type SellingChannel,
} from '@/lib/vendor-application';
import '@/components/ui/ui.css';

export function VendorSetupPage() {
  const navigate = useNavigate();
  const { session, vendor, refreshUser } = useAuth();
  const [businessName, setBusinessName] = useState(vendor?.business_name ?? '');
  const [productSummary, setProductSummary] = useState(vendor?.product_summary ?? '');
  const [description, setDescription] = useState(vendor?.business_description ?? '');
  const [category, setCategory] = useState(vendor?.category ?? '');
  const [streetAddress, setStreetAddress] = useState(vendor?.street_address ?? '');
  const [sellCity, setSellCity] = useState(vendor?.sell_city ?? '');
  const [sellState, setSellState] = useState(vendor?.sell_state ?? '');
  const [postalCode, setPostalCode] = useState(vendor?.postal_code ?? '');
  const [channels, setChannels] = useState<SellingChannel[]>(
    (vendor?.selling_channels as SellingChannel[]) ?? [],
  );
  const [primaryMarket, setPrimaryMarket] = useState(vendor?.primary_market ?? '');
  const [instagram, setInstagram] = useState(vendor?.instagram_url ?? '');
  const [website, setWebsite] = useState(vendor?.website_url ?? '');
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(option: SellingChannel) {
    setChannels((prev) =>
      prev.includes(option) ? prev.filter((c) => c !== option) : [...prev, option],
    );
  }

  async function handleSave() {
    if (!session?.user) return;

    const application = {
      business_name: businessName,
      product_summary: productSummary,
      business_description: description.trim() || null,
      category,
      sell_city: sellCity,
      sell_state: sellState,
      selling_channels: channels,
      primary_market: primaryMarket.trim() || null,
      instagram_url: normalizeUrl(instagram),
      website_url: normalizeUrl(website),
    };

    const validationError = validateVendorApplication(application, attested);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();

    const cleanCity = application.sell_city.trim();
    const cleanState = application.sell_state.trim().toUpperCase();
    const cleanStreet = streetAddress.trim();
    const cleanPostal = postalCode.trim();

    // Best-effort geocode so the vendor lands on the nearby map. Falls back to a
    // city/state centroid and never blocks the save on failure.
    const coords = await geocodeAddress({
      streetAddress: cleanStreet,
      city: cleanCity,
      state: cleanState,
      postalCode: cleanPostal,
      country: 'USA',
    });

    const { error: vendorError } = await supabase
      .from('vendors')
      .update({
        business_name: application.business_name.trim(),
        product_summary: application.product_summary.trim(),
        business_description: application.business_description,
        category: application.category,
        street_address: cleanStreet || null,
        sell_city: cleanCity,
        sell_state: cleanState,
        postal_code: cleanPostal || null,
        country: 'USA',
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        selling_channels: application.selling_channels,
        primary_market: application.primary_market,
        instagram_url: application.instagram_url,
        website_url: application.website_url,
        application_submitted_at: now,
        updated_at: now,
      })
      .eq('user_id', session.user.id);

    setLoading(false);
    if (vendorError) {
      setError(vendorError.message);
      return;
    }

    await refreshUser();
    navigate('/vendor/dashboard');
  }

  async function handleBack() {
    if (!session?.user) return;
    await resetRoleSelection(session.user.id, 'vendor');
    await refreshUser();
    navigate('/onboarding/role-select');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <button type="button" className="app-back-link" onClick={handleBack}>← Change role</button>
      <p className="app-eyebrow">Vendor onboarding</p>
      <h1 className="app-title">Tell us about your business</h1>

      <div className="app-input-group">
        <label>Business name</label>
        <input className="app-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>What do you sell?</label>
        <textarea className="app-textarea" value={productSummary} onChange={(e) => setProductSummary(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>About (optional)</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <p className="app-row-meta" style={{ marginBottom: '0.5rem' }}>Category</p>
      <div className="app-chip-row">
        {VENDOR_CATEGORY_OPTIONS.map((opt) => (
          <button key={opt} type="button" className={`app-chip${category === opt ? ' app-chip--selected' : ''}`} onClick={() => setCategory(opt)}>
            {opt}
          </button>
        ))}
      </div>

      <div className="app-input-group">
        <label>Street address</label>
        <input
          className="app-input"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          placeholder="123 Main St"
          autoComplete="street-address"
        />
      </div>
      <div className="app-input-group">
        <label>City</label>
        <input className="app-input" value={sellCity} onChange={(e) => setSellCity(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>State</label>
        <input className="app-input" value={sellState} onChange={(e) => setSellState(e.target.value)} maxLength={2} />
      </div>
      <div className="app-input-group">
        <label>ZIP code</label>
        <input
          className="app-input"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="78701"
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>

      <p className="app-row-meta" style={{ marginBottom: '0.5rem' }}>Where do you sell?</p>
      <div className="app-chip-row">
        {SELLING_CHANNEL_OPTIONS.map((opt) => (
          <button key={opt} type="button" className={`app-chip${channels.includes(opt) ? ' app-chip--selected' : ''}`} onClick={() => toggleChannel(opt)}>
            {opt}
          </button>
        ))}
      </div>

      <div className="app-input-group">
        <label>Primary market (optional)</label>
        <input className="app-input" value={primaryMarket} onChange={(e) => setPrimaryMarket(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Instagram URL</label>
        <input className="app-input" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Website URL</label>
        <input className="app-input" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        <span className="app-row-meta">I confirm this information is accurate and represents my business.</span>
      </label>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={loading} onClick={handleSave}>
        {loading ? 'Submitting…' : 'Submit application'}
      </button>
    </div>
  );
}
