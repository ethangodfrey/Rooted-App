import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { normalizeUrl } from '@/lib/vendor-application';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

function isValidUrl(raw: string): boolean {
  const normalized = normalizeUrl(raw);
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    return Boolean(url.hostname.includes('.'));
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'website' | 'instagram', string>>>({});

  useEffect(() => {
    setBusinessDescription(vendor?.business_description ?? '');
    setProductSummary(vendor?.product_summary ?? '');
    setWebsite(vendor?.website_url ?? '');
    setInstagram(vendor?.instagram_url ?? '');
  }, [vendor]);

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSave() {
    if (!vendor) return;

    const nextFieldErrors: Partial<Record<'website' | 'instagram', string>> = {};
    if (website.trim() && !isValidUrl(website)) {
      nextFieldErrors.website = 'Enter a valid website URL (e.g. https://example.com).';
    }
    if (instagram.trim() && !isValidUrl(instagram)) {
      nextFieldErrors.instagram = 'Enter a valid Instagram URL.';
    }

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
        instagram_url: normalizeUrl(instagram),
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
    <div className="app-screen app-screen--narrow">
      <Link to="/vendor/profile" className="app-back-link">← Profile</Link>
      <h1 className="app-title">Edit storefront</h1>

      <div className="app-input-group">
        <label>About your business</label>
        <textarea className="app-textarea" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Product summary</label>
        <textarea className="app-textarea" value={productSummary} onChange={(e) => setProductSummary(e.target.value)} />
      </div>
      <div className="app-form-grid">
        <div className="app-input-group">
          <label>Website</label>
          <input
            className={`app-input${fieldErrors.website ? ' app-input--invalid' : ''}`}
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              clearFieldError('website');
            }}
            placeholder="https://example.com"
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
            placeholder="https://instagram.com/you"
          />
          <FieldError message={fieldErrors.instagram} />
        </div>
      </div>

      {message ? <p className="app-message">{message}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save storefront'}
      </button>
    </div>
  );
}
