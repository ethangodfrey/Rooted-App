import { LegalPage } from '@/pages/marketing/LegalPage';

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 22, 2026">
      <p>
        Rooted (&quot;we&quot;, &quot;us&quot;) operates a farmers-market marketplace that helps shoppers
        discover local vendors and reserve products for pickup. This policy describes what we collect,
        why we collect it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account information: email address, name, phone number, and profile photo you provide.</li>
        <li>Location data: when you grant permission, we use your device location to show nearby events.</li>
        <li>Photos and media: product images and storefront assets you upload as a vendor.</li>
        <li>Usage data: basic app interactions needed to operate orders, reservations, and vendor tools.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Authenticate you and maintain your account.</li>
        <li>Display markets, events, vendors, and products relevant to your area.</li>
        <li>Process reservations and vendor order workflows.</li>
        <li>Improve reliability, security, and support.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We use Supabase for authentication and database
        hosting, and may use other service providers that process data on our behalf under contract.
        Vendor storefront information you choose to publish is visible to other users.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We retain account data while your account is active. You can delete your account from the
        profile screen in the app or web app. Deletion removes your authentication record and
        associated profile data subject to any legal retention requirements.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href="mailto:support@rooted.app">support@rooted.app</a>
      </p>
    </LegalPage>
  );
}
