import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

export function TermsPage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow legal-page">
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Terms of Service
        </h1>
        <p className="app-subtitle">Last updated: June 2026</p>

        <div className="legal-prose">
          <p>
            <strong>Draft notice:</strong> Replace this placeholder with counsel-reviewed text before
            App Store submission.
          </p>
          <p>
            By using Rooted, you agree to these terms. Rooted connects shoppers with local vendors and
            markets. Vendors are independent sellers; Rooted is not the seller of vendor products.
          </p>
          <h2>Accounts</h2>
          <p>You are responsible for your account credentials and activity under your account.</p>
          <h2>Reservations &amp; payments</h2>
          <p>
            Rooted v1 supports reserve-for-pickup (Model A). Payment is collected in person at pickup
            unless otherwise stated. Rooted does not process in-app card payments in v1.
          </p>
          <h2>Vendor content</h2>
          <p>
            Vendors are responsible for accurate listings, availability, and compliance with local
            laws. Rooted may moderate or remove content that violates policies.
          </p>
          <h2>Termination</h2>
          <p>
            You may delete your account at any time. We may suspend accounts that abuse the platform.
          </p>
          <h2>Contact</h2>
          <p>
            Questions: <a href="mailto:support@rooted.app">support@rooted.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}
