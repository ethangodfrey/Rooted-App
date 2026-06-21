import { Link } from 'react-router-dom';

import { Logo } from '@/components/Logo';
import '@/App.css';

export function TermsPage() {
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
        <h1>Terms of Service</h1>
        <p className="legal-page__updated">Last updated: June 21, 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Rooted. By creating an
          account or using the service, you agree to these Terms.
        </p>

        <h2>Marketplace model</h2>
        <p>
          Rooted helps shoppers discover vendors and place reservations for pickup. Unless clearly
          stated otherwise, payments are completed in person at pickup (Model A). Rooted is not the
          seller of vendor products and does not guarantee product quality, availability, or vendor
          conduct.
        </p>

        <h2>Accounts</h2>
        <ul>
          <li>You must provide accurate account information and keep credentials secure.</li>
          <li>You are responsible for activity under your account.</li>
          <li>You may delete your account at any time from profile settings.</li>
        </ul>

        <h2>Vendor obligations</h2>
        <ul>
          <li>Vendors must provide truthful business information and comply with applicable laws.</li>
          <li>Vendors are responsible for product safety, labeling, taxes, and permits.</li>
          <li>Rooted may review, approve, reject, or remove vendor listings at its discretion.</li>
        </ul>

        <h2>Shopper obligations</h2>
        <ul>
          <li>Reservations should be honored or cancelled promptly when plans change.</li>
          <li>Harassment, fraud, or misuse of the platform is prohibited.</li>
        </ul>

        <h2>Content</h2>
        <p>
          You retain ownership of content you submit, but grant Rooted a license to host, display,
          and distribute it as needed to operate the marketplace. Do not upload unlawful, infringing,
          or misleading content.
        </p>

        <h2>Disclaimers</h2>
        <p>
          Rooted is provided &quot;as is&quot; without warranties of uninterrupted or error-free
          operation. To the fullest extent permitted by law, Rooted is not liable for indirect or
          consequential damages arising from marketplace transactions between users.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend or terminate access for violations of these Terms or to protect users and
          the platform. You may stop using Rooted at any time and delete your account.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms: <a href="mailto:support@rooted.app">support@rooted.app</a>
        </p>
      </main>
    </div>
  );
}
