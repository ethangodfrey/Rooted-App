import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

export function TermsOfServicePage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Terms of Service
        </h1>
        <p className="app-subtitle">Last updated: June 2026</p>

        <div className="app-card" style={{ marginTop: '1.5rem', lineHeight: 1.6 }}>
          <p>
            By using Rooted, you agree to these terms. Rooted is a marketplace connecting shoppers with
            local farmers-market vendors.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Marketplace model</h2>
          <p>
            Rooted uses a reserve-for-pickup model (Model A). Reservations are not in-app purchases;
            payment occurs in person at pickup unless otherwise stated.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Vendor responsibilities</h2>
          <p>
            Vendors are responsible for product accuracy, food safety compliance, order fulfillment, and
            applicable licenses.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Shopper responsibilities</h2>
          <p>
            Shoppers agree to pick up reserved orders on time and communicate with vendors about
            cancellations when possible.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Account termination</h2>
          <p>
            You may delete your account at any time. We may suspend accounts that violate these terms or
            applicable law.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Contact</h2>
          <p>
            Questions? Email{' '}
            <a href="mailto:support@rooted.app">support@rooted.app</a>.
          </p>
          <p className="app-row-meta" style={{ marginTop: '1.5rem' }}>
            TODO(agent): Replace with counsel-reviewed terms before public App Store launch.
          </p>
        </div>
      </div>
    </div>
  );
}
