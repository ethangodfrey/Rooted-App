import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/App.css';

export function PrivacyPage() {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <div className="container">
          <Link to="/" className="legal-page__home">
            <Logo size="small" />
          </Link>
        </div>
      </header>

      <main className="container legal-page__body">
        <h1>Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: June 21, 2026</p>

        <p>
          Rooted (&quot;we&quot;, &quot;us&quot;) operates a farmers-market marketplace that helps
          shoppers discover local markets and vendors, and helps vendors manage storefronts, products,
          and reservations. This policy explains what we collect, why we collect it, and the choices
          you have.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> email address, name, phone number, profile photo,
            and role (shopper or vendor).
          </li>
          <li>
            <strong>Location:</strong> approximate or precise location when you use map and discovery
            features (with your permission).
          </li>
          <li>
            <strong>Vendor content:</strong> business details, product listings, photos, posts, and
            order/reservation data you create in the app.
          </li>
          <li>
            <strong>Usage data:</strong> basic diagnostics such as device type, app version, and
            error logs needed to operate and improve the service.
          </li>
        </ul>

        <h2>How we use information</h2>
        <ul>
          <li>Provide authentication, profiles, marketplace discovery, and order/reservation flows.</li>
          <li>Connect shoppers with vendors and display relevant events and products.</li>
          <li>Operate POS integrations you choose to connect (for example, Square).</li>
          <li>Send account-related emails such as confirmations and password resets.</li>
          <li>Protect the platform, prevent abuse, and comply with legal obligations.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          We do not sell your personal information. We share data with service providers that help us
          run Rooted (for example, hosting, authentication, and analytics infrastructure) under
          contractual safeguards. Vendor storefront information you publish is visible to other users
          as part of the marketplace.
        </p>

        <h2>Retention & deletion</h2>
        <p>
          We retain account data while your account is active. You may delete your account in the app
          profile settings, which removes your authentication record and cascades deletion of
          associated profile data subject to any records we must retain for legal or fraud-prevention
          reasons.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Update profile information in account settings.</li>
          <li>Control location permissions in your device settings.</li>
          <li>Delete your account from profile settings.</li>
          <li>Contact us at <a href="mailto:support@rooted.app">support@rooted.app</a>.</li>
        </ul>

        <h2>Children</h2>
        <p>Rooted is not directed to children under 13, and we do not knowingly collect their data.</p>

        <h2>Changes</h2>
        <p>
          We may update this policy. Material changes will be reflected on this page with an updated
          date.
        </p>
      </main>
    </div>
  );
}
