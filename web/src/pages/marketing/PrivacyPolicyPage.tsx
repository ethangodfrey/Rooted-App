import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

export function PrivacyPolicyPage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Privacy Policy
        </h1>
        <p className="app-subtitle">Last updated: June 2026</p>

        <div className="app-card" style={{ marginTop: '1.5rem', lineHeight: 1.6 }}>
          <p>
            Rooted (&quot;we&quot;, &quot;us&quot;) operates a farmers-market marketplace that helps shoppers
            discover local markets and reserve products from vendors.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Information we collect</h2>
          <ul>
            <li>Account information: email, name, phone, profile photo</li>
            <li>Location data: to show nearby markets and events (with your permission)</li>
            <li>Photos: when you upload product images or profile photos</li>
            <li>Order and reservation data: products reserved for pickup</li>
          </ul>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>How we use information</h2>
          <p>
            We use your information to provide the marketplace, process reservations, communicate about
            orders, and improve the app. We do not sell your personal information.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Data retention and deletion</h2>
          <p>
            You can delete your account at any time from your profile settings. Deletion permanently removes
            your account and associated data.
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>Contact</h2>
          <p>
            Questions? Email{' '}
            <a href="mailto:support@rooted.app">support@rooted.app</a>.
          </p>
          <p className="app-row-meta" style={{ marginTop: '1.5rem' }}>
            TODO(agent): Replace with counsel-reviewed policy before public App Store launch.
          </p>
        </div>
      </div>
    </div>
  );
}
