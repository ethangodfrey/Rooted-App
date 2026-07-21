import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

/**
 * Unified creator settings — Stripe payouts, SNAP/EBT, and meetup/delivery rules.
 */
export function CreatorSettingsPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Settings</h1>
      <p className="app-subtitle">
        Payouts, SNAP discovery, and how shoppers meet you for pickup or delivery.
      </p>

      <div className="app-profile-big-cards">
        <Link to="/vendor/settings/payments" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            💳
          </span>
          <div>
            <p className="app-profile-big-card__title">Stripe payouts & SNAP / EBT</p>
            <p className="app-profile-big-card__meta">
              Connect Stripe, set pre-order payment policy, toggle SNAP discovery
            </p>
          </div>
        </Link>

        <Link to="/vendor/storefront" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            📍
          </span>
          <div>
            <p className="app-profile-big-card__title">Meetup & delivery rules</p>
            <p className="app-profile-big-card__meta">
              Pickup notes, location, and shipping details on your storefront
            </p>
          </div>
        </Link>

        <Link to="/vendor/profile" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            🏪
          </span>
          <div>
            <p className="app-profile-big-card__title">Business profile</p>
            <p className="app-profile-big-card__meta">Name, bio, and public presence</p>
          </div>
        </Link>

        <Link to="/vendor/compliance" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            ✅
          </span>
          <div>
            <p className="app-profile-big-card__title">Compliance</p>
            <p className="app-profile-big-card__meta">Credentials and trust badges</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
