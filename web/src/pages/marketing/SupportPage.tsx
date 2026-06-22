import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import '@/App.css';

export function SupportPage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '2rem' }}>
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Support
        </h1>
        <p className="app-subtitle">
          Need help with your account, a reservation, or a vendor listing? We&apos;re here to help.
        </p>
        <div className="app-card" style={{ marginTop: '1.5rem' }}>
          <p className="app-row-title">Email</p>
          <p>
            <a href="mailto:support@rooted.app">support@rooted.app</a>
          </p>
        </div>
        <p style={{ marginTop: '1.5rem' }}>
          <a href={getPrivacyPolicyUrl()}>Privacy Policy</a>
          {' · '}
          <a href={getTermsOfServiceUrl()}>Terms of Service</a>
        </p>
      </div>
    </div>
  );
}
