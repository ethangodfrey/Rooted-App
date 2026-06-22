import { LegalPage } from '@/pages/marketing/LegalPage';

export function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 22, 2026">
      <p>
        These Terms govern your use of Rooted. By creating an account, you agree to these Terms and
        our Privacy Policy.
      </p>

      <h2>Marketplace model</h2>
      <p>
        Rooted connects shoppers and independent vendors. Unless otherwise stated, reservations are
        for pickup at market or an agreed location. Payment is collected in person at pickup unless a
        future in-app payment feature is explicitly offered.
      </p>

      <h2>Accounts and roles</h2>
      <p>
        You must provide accurate information. Vendor accounts may require admin approval before
        appearing publicly. You are responsible for activity under your account.
      </p>

      <h2>Vendor responsibilities</h2>
      <ul>
        <li>List only products you can fulfill and comply with applicable food and business laws.</li>
        <li>Honor reservations and communicate changes promptly.</li>
        <li>Do not post misleading, harmful, or illegal content.</li>
      </ul>

      <h2>Shopper responsibilities</h2>
      <ul>
        <li>Pick up reservations on time or cancel when you cannot attend.</li>
        <li>Treat vendors and market staff respectfully.</li>
      </ul>

      <h2>Prohibited use</h2>
      <p>
        You may not abuse the platform, scrape data at scale, attempt unauthorized access, or use
        Rooted for unlawful purposes.
      </p>

      <h2>Disclaimer</h2>
      <p>
        Rooted is provided &quot;as is&quot;. We are not a party to transactions between shoppers and
        vendors except as a technology platform.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. Continued use after changes constitutes acceptance of the updated
        Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:support@rooted.app">support@rooted.app</a>
      </p>
    </LegalPage>
  );
}
