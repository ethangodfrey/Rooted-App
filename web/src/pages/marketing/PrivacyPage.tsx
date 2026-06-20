import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/components/ui/ui.css';

export function PrivacyPage() {
  return (
    <div className="app-shell">
      <div className="app-screen app-screen--narrow legal-page">
        <Link to="/" className="auth-home-link">
          ← Back to home
        </Link>
        <Logo size="medium" />
        <h1 className="app-title" style={{ marginTop: '1rem' }}>
          Privacy Policy
        </h1>
        <p className="app-subtitle">Last updated: June 2026</p>

        <div className="legal-prose">
          <p>
            <strong>Draft notice:</strong> Replace this placeholder with counsel-reviewed text before
            App Store submission.
          </p>
          <p>
            Rooted (&quot;we&quot;, &quot;us&quot;) operates a farmers-market marketplace that helps
            shoppers discover local markets and vendors, and helps vendors manage listings, orders, and
            posts.
          </p>
          <h2>Information we collect</h2>
          <ul>
            <li>Account information (email, name, phone, profile photo)</li>
            <li>Location data when you use map features (with your permission)</li>
            <li>Photos you upload for products or posts</li>
            <li>Order and reservation activity within the app</li>
          </ul>
          <h2>How we use information</h2>
          <p>
            We use your information to provide the service, process reservations, improve the product,
            and communicate about your account. We do not sell personal information.
          </p>
          <h2>Data retention &amp; deletion</h2>
          <p>
            You may delete your account at any time from Profile → Delete account. Deletion removes your
            auth account and associated profile data subject to legal retention requirements.
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
