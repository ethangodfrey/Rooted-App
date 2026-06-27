import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { geocodeAddress } from '@/lib/geocode';
import { supabase } from '@/lib/supabase';
import { uploadBannerImage, uploadProfilePhoto } from '@/lib/upload';
import '@/components/ui/ui.css';

export function ChefSetupPage() {
  const navigate = useNavigate();
  const { user, chef, refreshUser } = useAuth();
  const photoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(chef?.display_name ?? '');
  const [bio, setBio] = useState(chef?.bio ?? '');
  const [city, setCity] = useState(chef?.home_base_city ?? '');
  const [state, setState] = useState(chef?.home_base_state ?? '');
  const [streetAddress, setStreetAddress] = useState(chef?.street_address ?? '');
  const [postalCode, setPostalCode] = useState(chef?.postal_code ?? '');
  const [cuisines, setCuisines] = useState((chef?.cuisine_specialties ?? []).join(', '));
  const [photoUrl, setPhotoUrl] = useState(chef?.profile_photo_url ?? '');
  const [bannerUrl, setBannerUrl] = useState(chef?.banner_url ?? '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleBannerChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingBanner(true);
    setError(null);
    try {
      const url = await uploadBannerImage(user.id, file);
      setBannerUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload banner.');
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSave() {
    if (!chef?.id) {
      setError('Chef profile is still loading. Try again in a moment.');
      return;
    }
    if (!displayName.trim() || !bio.trim() || !city.trim() || !state.trim()) {
      setError('Display name, bio, city, and state are required.');
      return;
    }

    setSaving(true);
    setError(null);

    const cleanStreet = streetAddress.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim().toUpperCase();
    const cleanPostal = postalCode.trim();

    // Best-effort geocode so the chef is geo-ranked in nearby/search. Falls back
    // to a city/state centroid and never blocks the save on failure.
    const coords = await geocodeAddress({
      streetAddress: cleanStreet,
      city: cleanCity,
      state: cleanState,
      postalCode: cleanPostal,
      country: 'USA',
    });

    const { error: updateError } = await supabase
      .from('chefs')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        street_address: cleanStreet || null,
        home_base_city: cleanCity,
        home_base_state: cleanState,
        postal_code: cleanPostal || null,
        country: 'USA',
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        profile_photo_url: photoUrl || null,
        banner_url: bannerUrl || null,
        cuisine_specialties: cuisines
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chef.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refreshUser();
    navigate('/chef/dashboard');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">Chef onboarding</p>
      <h1 className="app-title">Set up your chef profile</h1>
      <p className="app-subtitle">
        Tell customers about your culinary style and where you serve.
      </p>

      <div className="profile-avatar-block">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar profile-avatar--placeholder">👨‍🍳</div>
        )}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handlePhotoChange(e.target.files?.[0])}
        />
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={uploadingPhoto}
          onClick={() => photoRef.current?.click()}
        >
          {uploadingPhoto ? 'Uploading…' : 'Change profile photo'}
        </button>
        {photoUrl ? (
          <button type="button" className="profile-remove-photo" onClick={() => setPhotoUrl('')}>
            Remove photo
          </button>
        ) : null}
      </div>

      <div className="app-input-group">
        <label>Banner image</label>
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            style={{
              width: '100%',
              borderRadius: '16px',
              marginBottom: '0.75rem',
              maxHeight: '160px',
              objectFit: 'cover',
            }}
          />
        ) : null}
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleBannerChange(e.target.files?.[0])}
        />
        <div className="app-row" style={{ gap: '0.5rem' }}>
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            disabled={uploadingBanner}
            onClick={() => bannerRef.current?.click()}
          >
            {uploadingBanner ? 'Uploading…' : bannerUrl ? 'Change banner' : 'Add banner'}
          </button>
          {bannerUrl ? (
            <button type="button" className="profile-remove-photo" onClick={() => setBannerUrl('')}>
              Remove banner
            </button>
          ) : null}
        </div>
      </div>

      <div className="app-input-group">
        <label htmlFor="chef-name">Display name</label>
        <input
          id="chef-name"
          className="app-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Chef Maria"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-bio">Bio</label>
        <textarea
          id="chef-bio"
          className="app-textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Your background, signature dishes, and what makes your cooking special."
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-cuisines">Cuisine specialties (comma-separated)</label>
        <input
          id="chef-cuisines"
          className="app-input"
          value={cuisines}
          onChange={(e) => setCuisines(e.target.value)}
          placeholder="Italian, Mediterranean"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-street">Street address (optional)</label>
        <input
          id="chef-street"
          className="app-input"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          placeholder="123 Main St"
          autoComplete="street-address"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-city">City</label>
        <input
          id="chef-city"
          className="app-input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Austin"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-state">State</label>
        <input
          id="chef-state"
          className="app-input"
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase())}
          maxLength={2}
          placeholder="TX"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="chef-zip">ZIP code (optional)</label>
        <input
          id="chef-zip"
          className="app-input"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="78701"
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--primary"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  );
}
