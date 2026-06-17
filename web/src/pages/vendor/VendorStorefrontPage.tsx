import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function VendorStorefrontPage() {
  const { vendor, refreshUser } = useAuth();
  const [businessDescription, setBusinessDescription] = useState(vendor?.business_description ?? '');
  const [productSummary, setProductSummary] = useState(vendor?.product_summary ?? '');
  const [website, setWebsite] = useState(vendor?.website_url ?? '');
  const [instagram, setInstagram] = useState(vendor?.instagram_url ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBusinessDescription(vendor?.business_description ?? '');
    setProductSummary(vendor?.product_summary ?? '');
    setWebsite(vendor?.website_url ?? '');
    setInstagram(vendor?.instagram_url ?? '');
  }, [vendor]);

  async function handleSave() {
    if (!vendor) return;
    setSaving(true);
    const { error } = await supabase
      .from('vendors')
      .update({
        business_description: businessDescription.trim() || null,
        product_summary: productSummary.trim() || null,
        website_url: website.trim() || null,
        instagram_url: instagram.trim() || null,
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
      <div className="app-input-group">
        <label>Website</label>
        <input className="app-input" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Instagram</label>
        <input className="app-input" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
      </div>

      {message ? <p className="app-message">{message}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save storefront'}
      </button>
    </div>
  );
}
