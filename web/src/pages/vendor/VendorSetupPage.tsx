import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { geocodeAddress } from '@/lib/geocode';
import { resetRoleSelection } from '@/lib/reset-role-selection';
import { supabase } from '@/lib/supabase';
import {
  normalizeUrl,
  SELLING_CHANNEL_OPTIONS,
  validateVendorApplicationFields,
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function toggleChannel(option: SellingChannel) {
    setChannels((prev) => {
      const next = prev.includes(option) ? prev.filter((c) => c !== option) : [...prev, option];
      if (next.length > 0) clearFieldError('selling_channels');
      return next;
    });
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

    const validationErrors = validateVendorApplicationFields(application, attested);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
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
      setFormError(vendorError.message);
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
        <label htmlFor="vendor-business-name">Business name</label>
        <input
          id="vendor-business-name"
          className={`app-input${fieldErrors.business_name ? ' app-input--invalid' : ''}`}
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            clearFieldError('business_name');
          }}
          aria-invalid={Boolean(fieldErrors.business_name)}
          aria-describedby={fieldErrors.business_name ? 'vendor-business-name-error' : undefined}
        />
        <FieldError id="vendor-business-name-error" message={fieldErrors.business_name} />
      </div>
      <div className="app-input-group">
        <label htmlFor="vendor-product-summary">What do you sell?</label>
        <textarea
          id="vendor-product-summary"
          className={`app-textarea${fieldErrors.product_summary ? ' app-textarea--invalid' : ''}`}
          value={productSummary}
          onChange={(e) => {
            setProductSummary(e.target.value);
            clearFieldError('product_summary');
          }}
          aria-invalid={Boolean(fieldErrors.product_summary)}
          aria-describedby={fieldErrors.product_summary ? 'vendor-product-summary-error' : undefined}
        />
        <FieldError id="vendor-product-summary-error" message={fieldErrors.product_summary} />
      </div>
      <div className="app-input-group">
        <label>About (optional)</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <p className="app-row-meta" style={{ marginBottom: '0.5rem' }}>Category</p>
      <div className="app-chip-row">
        {VENDOR_CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`app-chip${category === opt ? ' app-chip--selected' : ''}`}
            onClick={() => {
              setCategory(opt);
              clearFieldError('category');
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <FieldError message={fieldErrors.category} />

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
        <label htmlFor="vendor-city">City</label>
        <input
          id="vendor-city"
          className={`app-input${fieldErrors.sell_city ? ' app-input--invalid' : ''}`}
          value={sellCity}
          onChange={(e) => {
            setSellCity(e.target.value);
            clearFieldError('sell_city');
          }}
          aria-invalid={Boolean(fieldErrors.sell_city)}
          aria-describedby={fieldErrors.sell_city ? 'vendor-city-error' : undefined}
        />
        <FieldError id="vendor-city-error" message={fieldErrors.sell_city} />
      </div>
      <div className="app-input-group">
        <label htmlFor="vendor-state">State</label>
        <input
          id="vendor-state"
          className={`app-input${fieldErrors.sell_state ? ' app-input--invalid' : ''}`}
          value={sellState}
          onChange={(e) => {
            setSellState(e.target.value);
            clearFieldError('sell_state');
          }}
          maxLength={2}
          aria-invalid={Boolean(fieldErrors.sell_state)}
          aria-describedby={fieldErrors.sell_state ? 'vendor-state-error' : undefined}
        />
        <FieldError id="vendor-state-error" message={fieldErrors.sell_state} />
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
      <FieldError message={fieldErrors.selling_channels} />

      <div className="app-input-group">
        <label>Primary market (optional)</label>
        <input className="app-input" value={primaryMarket} onChange={(e) => setPrimaryMarket(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label htmlFor="vendor-instagram">Instagram URL</label>
        <input
          id="vendor-instagram"
          className={`app-input${fieldErrors.instagram_url ? ' app-input--invalid' : ''}`}
          value={instagram}
          onChange={(e) => {
            setInstagram(e.target.value);
            clearFieldError('instagram_url');
            clearFieldError('website_url');
          }}
          aria-invalid={Boolean(fieldErrors.instagram_url)}
          aria-describedby={fieldErrors.instagram_url ? 'vendor-instagram-error' : undefined}
        />
        <FieldError id="vendor-instagram-error" message={fieldErrors.instagram_url} />
      </div>
      <div className="app-input-group">
        <label htmlFor="vendor-website">Website URL</label>
        <input
          id="vendor-website"
          className={`app-input${fieldErrors.website_url ? ' app-input--invalid' : ''}`}
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            clearFieldError('website_url');
            clearFieldError('instagram_url');
          }}
          aria-invalid={Boolean(fieldErrors.website_url)}
          aria-describedby={fieldErrors.website_url ? 'vendor-website-error' : undefined}
        />
        <FieldError id="vendor-website-error" message={fieldErrors.website_url} />
      </div>

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => {
            setAttested(e.target.checked);
            clearFieldError('attestation');
          }}
        />
        <span className="app-row-meta">I confirm this information is accurate and represents my business.</span>
      </label>
      <FieldError message={fieldErrors.attestation} />

      {formError ? <p className="app-error">{formError}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={loading} onClick={handleSave}>
        {loading ? 'Submitting…' : 'Submit application'}
      </button>
    </div>
  );
}
