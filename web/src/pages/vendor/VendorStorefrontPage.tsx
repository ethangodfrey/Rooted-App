import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
} from '@/components/vendor/vendor-ui';
import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import {
  normalizeUrl,
  validateOptionalInstagram,
  validateOptionalUrl,
} from '@/lib/vendor-application';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type StorefrontField = 'website' | 'instagram';

export function VendorStorefrontPage() {
  const { vendor, refreshUser } = useAuth();
  const [businessDescription, setBusinessDescription] = useState(vendor?.business_description ?? '');
  const [productSummary, setProductSummary] = useState(vendor?.product_summary ?? '');
  const [website, setWebsite] = useState(vendor?.website_url ?? '');
  const [instagram, setInstagram] = useState(vendor?.instagram_url ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<StorefrontField, string>>>({});

  useEffect(() => {
    setBusinessDescription(vendor?.business_description ?? '');
    setProductSummary(vendor?.product_summary ?? '');
    setWebsite(vendor?.website_url ?? '');
    setInstagram(vendor?.instagram_url ?? '');
  }, [vendor]);

  function clearFieldError(field: StorefrontField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSave() {
    if (!vendor) return;

    const nextFieldErrors: Partial<Record<StorefrontField, string>> = {};
    const websiteError = validateOptionalUrl(website, 'website');
    if (websiteError) nextFieldErrors.website = websiteError;
    const instagramError = validateOptionalInstagram(instagram);
    if (instagramError) nextFieldErrors.instagram = instagramError;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setMessage(null);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    const { error } = await supabase
      .from('vendors')
      .update({
        business_description: businessDescription.trim() || null,
        product_summary: productSummary.trim() || null,
        website_url: normalizeUrl(website),
        instagram_url: instagram.trim().startsWith('@')
          ? normalizeUrl(`https://instagram.com/${instagram.trim().slice(1)}`)
          : normalizeUrl(instagram),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor.id);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refreshUser();
    setMessage('Storefront updated.');
  }

  return (
    <VendorScreen>
      <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
      <VendorHero eyebrow="Storefront" title="Edit storefront" />

      <VendorFormPanel>
        <div className="app-input-group">
          <label>About your business</label>
          <textarea className="app-textarea" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>Product summary</label>
          <textarea className="app-textarea" value={productSummary} onChange={(e) => setProductSummary(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>Website</label>
          <input
            className={`app-input${fieldErrors.website ? ' app-input--invalid' : ''}`}
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              clearFieldError('website');
            }}
            placeholder="https://yourshop.com"
          />
          <FieldError message={fieldErrors.website} />
        </div>
        <div className="app-input-group">
          <label>Instagram</label>
          <input
            className={`app-input${fieldErrors.instagram ? ' app-input--invalid' : ''}`}
            value={instagram}
            onChange={(e) => {
              setInstagram(e.target.value);
              clearFieldError('instagram');
            }}
            placeholder="@yourshop or https://instagram.com/yourshop"
          />
          <FieldError message={fieldErrors.instagram} />
        </div>

        {message ? <p className="app-message">{message}</p> : null}

        <VendorPrimaryButton className="w-full" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save storefront'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
