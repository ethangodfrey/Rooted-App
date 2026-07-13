import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function ChefProfilePage() {
  const { user, chef, signOut } = useAuth();

  const displayEmail = user?.email ?? '—';

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Account</p>
      <h1 className="app-title">Profile</h1>

      <div className="app-card profile-summary-card">
        <div className="app-row">
          <FallbackImage
            src={chef?.profile_photo_url}
            alt=""
            variant="avatar"
            label={chef?.display_name ?? displayEmail}
            className="profile-avatar profile-avatar--small"
          />
          <div className="app-row-body">
            <p className="app-row-title">{chef?.display_name?.trim() || 'Chef'}</p>
            <p className="app-row-meta">{displayEmail}</p>
            {chef ? (
              <p className="app-row-meta">
                {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ')}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          to="/chef/setup"
          className="app-btn app-btn--secondary"
          style={{ marginTop: '1rem' }}
        >
          Edit profile
        </Link>
      </div>

      <div className="app-list">
        <Link to="/chef/services" className="app-card app-card--pressable">
          <p className="app-row-title">Services</p>
          <p className="app-row-meta">Manage your offerings and pricing</p>
        </Link>
        <Link to="/chef/portfolio" className="app-card app-card--pressable">
          <p className="app-row-title">Portfolio</p>
          <p className="app-row-meta">Showcase posts on the Explore feed</p>
        </Link>
        <Link to="/chef/credentials" className="app-card app-card--pressable">
          <p className="app-row-title">Verification credentials</p>
          <p className="app-row-meta">Upload documents to earn trust badges</p>
        </Link>
      </div>

      <button
        type="button"
        className="app-btn app-btn--secondary"
        style={{ marginTop: '2rem' }}
        onClick={signOut}
      >
        Sign out
      </button>
    </div>
  );
}
