import { Link } from 'react-router-dom';

import '@/components/ui/ui.css';

/**
 * Unified creator settings — Stripe payouts, SNAP/EBT, and meetup/delivery rules.
 * Links stay on creator-prefixed aliases where possible.
 */
export function CreatorSettingsPage() {
  return (
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">Creator workspace</p>
      <h1 className="app-title">Creator settings</h1>
      <p className="app-subtitle">
        Payouts, SNAP discovery, and how shoppers meet you for pickup or delivery.
      </p>

      <div className="app-profile-big-cards">
        <Link to="/vendor/settings/payments" className="app-profile-big-card">
          <div>
            <p className="app-profile-big-card__title">Stripe payouts and SNAP / EBT</p>
            <p className="app-profile-big-card__meta">
              Connect Stripe, set pre-order payment policy, toggle SNAP discovery
            </p>
          </div>
        </Link>

        <Link to="/creator/listings" className="app-profile-big-card">
          <div>
            <p className="app-profile-big-card__title">Creator listings</p>
            <p className="app-profile-big-card__meta">
              Manage catalog items shown in your creator shell
            </p>
          </div>
        </Link>

        <Link to="/creator/network" className="app-profile-big-card">
          <div>
            <p className="app-profile-big-card__title">Creator network</p>
            <p className="app-profile-big-card__meta">V2V peer connections and wholesale partners</p>
          </div>
        </Link>

        <Link to="/vendor/profile" className="app-profile-big-card">
          <div>
            <p className="app-profile-big-card__title">Business profile</p>
            <p className="app-profile-big-card__meta">Name, bio, and public presence</p>
          </div>
        </Link>

        <Link to="/vendor/compliance" className="app-profile-big-card">
          <div>
            <p className="app-profile-big-card__title">Compliance</p>
            <p className="app-profile-big-card__meta">Credentials and trust badges</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
