import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
} from '@/components/vendor/vendor-ui';
import { FlashPromoWidget } from '@/components/vendor/FlashPromoWidget';
import { useAuth } from '@/hooks/use-auth';
import { normalizeUrl } from '@/lib/vendor-application';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

type StorefrontField = 'website' | 'instagram' | 'businessDescription' | 'productSummary';

function isValidOptionalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const normalized = normalizeUrl(trimmed);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function VendorStorefrontPage() {
  const { vendor, refreshUser } = useAuth();
  const [businessDescription, setBusinessDescription] = useState(vendor?.business_description ?? '');
  const [productSummary, setProductSummary] = useState(vendor?.product_summary ?? '');
  const [website, setWebsite] = useState(vendor?.website_url ?? '');
  const [instagram, setInstagram] = useState(vendor?.instagram_url ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const trimmedDescription = businessDescription.trim();
    const trimmedSummary = productSummary.trim();

    if (trimmedDescription.length > 2000) {
      nextFieldErrors.businessDescription = 'About section must be 2,000 characters or fewer.';
    }
    if (trimmedSummary.length > 500) {
      nextFieldErrors.productSummary = 'Product summary must be 500 characters or fewer.';
    }
    if (!isValidOptionalUrl(website)) {
      nextFieldErrors.website = 'Enter a valid website URL (e.g. https://yourfarm.com).';
    }
    if (!isValidOptionalUrl(instagram)) {
      nextFieldErrors.instagram = 'Enter a valid Instagram URL or profile link.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setMessage(null);
      setError(null);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: saveError } = await supabase
      .from('vendors')
      .update({
        business_description: trimmedDescription || null,
        product_summary: trimmedSummary || null,
        website_url: normalizeUrl(website),
        instagram_url: normalizeUrl(instagram),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor.id);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    await refreshUser();
    setMessage('Storefront updated.');
  }

  return (
    <VendorScreen>
      <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
      <VendorHero eyebrow="Storefront" title="Edit storefront" />

      <FlashPromoWidget vendorId={vendor?.id} />

      <VendorFormPanel>
        <div className="app-input-group">
          <label htmlFor="storefront-about">About your business</label>
          <textarea
            id="storefront-about"
            className={`app-textarea${fieldErrors.businessDescription ? ' app-textarea--invalid' : ''}`}
            value={businessDescription}
            aria-invalid={Boolean(fieldErrors.businessDescription)}
            onChange={(e) => {
              setBusinessDescription(e.target.value);
              clearFieldError('businessDescription');
            }}
          />
          <FieldError message={fieldErrors.businessDescription} />
        </div>
        <div className="app-input-group">
          <label htmlFor="storefront-summary">Product summary</label>
          <textarea
            id="storefront-summary"
            className={`app-textarea${fieldErrors.productSummary ? ' app-textarea--invalid' : ''}`}
            value={productSummary}
            aria-invalid={Boolean(fieldErrors.productSummary)}
            onChange={(e) => {
              setProductSummary(e.target.value);
              clearFieldError('productSummary');
            }}
          />
          <FieldError message={fieldErrors.productSummary} />
        </div>
        <div className="app-input-group">
          <label htmlFor="storefront-website">Website</label>
          <input
            id="storefront-website"
            className={`app-input${fieldErrors.website ? ' app-input--invalid' : ''}`}
            type="url"
            inputMode="url"
            placeholder="https://yourfarm.com"
            value={website}
            aria-invalid={Boolean(fieldErrors.website)}
            onChange={(e) => {
              setWebsite(e.target.value);
              clearFieldError('website');
            }}
          />
          <FieldError message={fieldErrors.website} />
        </div>
        <div className="app-input-group">
          <label htmlFor="storefront-instagram">Instagram</label>
          <input
            id="storefront-instagram"
            className={`app-input${fieldErrors.instagram ? ' app-input--invalid' : ''}`}
            type="url"
            inputMode="url"
            placeholder="https://instagram.com/yourhandle"
            value={instagram}
            aria-invalid={Boolean(fieldErrors.instagram)}
            onChange={(e) => {
              setInstagram(e.target.value);
              clearFieldError('instagram');
            }}
          />
          <FieldError message={fieldErrors.instagram} />
        </div>

        {error ? <p className="app-error">{error}</p> : null}
        {message ? <p className="app-message">{message}</p> : null}

        <VendorPrimaryButton className="w-full" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save storefront'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
