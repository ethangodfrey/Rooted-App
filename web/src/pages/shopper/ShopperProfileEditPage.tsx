import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { updateShopperEmail, updateShopperProfile } from '@/lib/shopper-profile';
import { supabase } from '@/lib/supabase';
import { uploadProfilePhoto } from '@/lib/upload';
import '@/components/ui/ui.css';

export function ShopperProfileEditPage() {
  const navigate = useNavigate();
  const { user, session, refreshUser } = useAuth();
  const { saved, remove, pending: savedPending } = useSavedVendors();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? session?.user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo ?? '');
  const [vendors, setVendors] = useState<{ id: string; business_name: string | null; category: string | null }[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? session?.user?.email ?? '');
    setPhone(user?.phone ?? '');
    setPhotoUrl(user?.profile_photo ?? '');
  }, [user, session?.user?.email]);

  useEffect(() => {
    async function load() {
      if (saved.length === 0) {
        setVendors([]);
        return;
      }
      setLoadingVendors(true);
      const { data } = await supabase.from('vendors').select('id, business_name, category').in('id', saved);
      setVendors(data ?? []);
      setLoadingVendors(false);
    }
    load();
  }, [saved]);

  async function handlePhotoChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadProfilePhoto(user.id, file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const profileResult = await updateShopperProfile(user.id, {
      name,
      phone,
      profile_photo: photoUrl || null,
    });

    if (profileResult.error) {
      setSaving(false);
      setError(profileResult.error);
      return;
    }

    const currentEmail = user.email ?? session?.user?.email ?? '';
    let emailMessage: string | null = null;

    if (email.trim() && email.trim() !== currentEmail) {
      const emailResult = await updateShopperEmail(email);
      if (emailResult.error) {
        setSaving(false);
        setError(emailResult.error);
        return;
      }
      if (emailResult.confirmationRequired) {
        emailMessage = 'Profile saved. Check your inbox to confirm your new email address.';
      }
    }

    await refreshUser();
    setSaving(false);

    if (emailMessage) {
      setMessage(emailMessage);
      return;
    }

    navigate('/shopper/profile');
  }

  const initials = (name || email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/shopper/profile" className="app-back-link">
        ← Profile
      </Link>

      <p className="app-eyebrow">Your account</p>
      <h1 className="app-title">Edit profile</h1>
      <p className="app-subtitle">Update your photo, contact info, and saved vendors.</p>

      <div className="profile-avatar-block">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar profile-avatar--placeholder">{initials}</div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handlePhotoChange(e.target.files?.[0])}
        />
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={uploadingPhoto}
          onClick={() => fileRef.current?.click()}
        >
          {uploadingPhoto ? 'Uploading…' : 'Change photo'}
        </button>
        {photoUrl ? (
          <button type="button" className="profile-remove-photo" onClick={() => setPhotoUrl('')}>
            Remove photo
          </button>
        ) : null}
      </div>

      <div className="app-input-group">
        <label htmlFor="name">Name</label>
        <input id="name" className="app-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="app-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="app-row-meta" style={{ marginTop: '0.375rem' }}>
          Changing your email may require confirmation via inbox.
        </p>
      </div>
      <div className="app-input-group">
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          className="app-input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.75rem' }}>Saved vendors</h2>
      {loadingVendors ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : vendors.length === 0 ? (
        <p className="app-row-meta">Vendors you save appear here.</p>
      ) : (
        <div className="app-list">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="app-card app-row saved-vendor-row">
              <Link to={`/shopper/vendors/${vendor.id}`} className="app-row-body" style={{ textDecoration: 'none', color: 'inherit' }}>
                <p className="app-row-title">{vendor.business_name ?? 'Vendor'}</p>
                {vendor.category ? <p className="app-row-meta">{vendor.category}</p> : null}
              </Link>
              <button
                type="button"
                className="saved-vendor-remove"
                disabled={savedPending}
                onClick={() => remove(vendor.id)}
                aria-label={`Remove ${vendor.business_name ?? 'vendor'}`}
              >
                ♥
              </button>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="app-error">{error}</p> : null}
      {message ? <p className="app-message">{message}</p> : null}

      <button type="button" className="app-btn app-btn--primary" style={{ marginTop: '1.5rem' }} disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
