import { LegalLayout } from './LegalLayout';
import { BRAND_NAME, PRIVACY_EMAIL, SUPPORT_EMAIL } from './legal-config';

export function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" documentTitle={`Privacy Policy — ${BRAND_NAME}`}>
      <p className="legal-intro">
        {BRAND_NAME} (&ldquo;{BRAND_NAME},&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) operates a marketplace that connects shoppers with local farmers
        markets, independent vendors, and the products they sell. This Privacy Policy explains
        what information we collect, how we use it, and the choices you have. It applies to our
        website and mobile apps (collectively, the &ldquo;Service&rdquo;).
      </p>

      <nav className="legal-toc" aria-label="Table of contents">
        <h2>On this page</h2>
        <ol>
          <li><a href="#information-we-collect">Information we collect</a></li>
          <li><a href="#how-we-use">How we use your information</a></li>
          <li><a href="#sharing">How we share information</a></li>
          <li><a href="#service-providers">Service providers</a></li>
          <li><a href="#your-rights">Your rights and choices</a></li>
          <li><a href="#retention">Data retention</a></li>
          <li><a href="#security">Security</a></li>
          <li><a href="#children">Children&apos;s privacy</a></li>
          <li><a href="#changes">Changes to this policy</a></li>
          <li><a href="#contact">Contact us</a></li>
        </ol>
      </nav>

      <h2 id="information-we-collect">Information We Collect</h2>

      <h3>Information you provide</h3>
      <ul>
        <li>Account information (name, email address, and password credentials)</li>
        <li>Profile and storefront information (display name, photo, bio, and—for vendors—business name, description, and links)</li>
        <li>Location information (the address or city you search for, and—with your permission—your device location for nearby discovery and maps)</li>
        <li>Transaction information (reservations, orders, pickup details, and point-of-sale records that vendors log)</li>
        <li>Content you upload (product photos, posts, videos, and other materials)</li>
        <li>Communications (support requests and messages you send us)</li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li>Device information (device type, operating system, and unique identifiers)</li>
        <li>Usage data (features used, pages viewed, and session activity)</li>
        <li>Approximate location derived from your IP address</li>
        <li>Log data, diagnostics, and crash or performance reports</li>
      </ul>

      <h2 id="how-we-use">How We Use Your Information</h2>
      <ul>
        <li>Provide, maintain, and improve the marketplace</li>
        <li>Connect shoppers with vendors, markets, and products</li>
        <li>Process reservations, orders, and pickups</li>
        <li>Send order updates, confirmations, and service notifications</li>
        <li>Review and verify vendor applications and storefronts</li>
        <li>Personalize discovery, feeds, and recommendations</li>
        <li>Detect, prevent, and respond to fraud, abuse, and policy violations</li>
        <li>Comply with legal obligations and enforce our terms</li>
      </ul>

      <h2 id="sharing">How We Share Information</h2>
      <p>We share information in the following circumstances:</p>
      <ul>
        <li>
          <strong>With other users.</strong> Your public profile, storefront, posts, and
          reservation details are shared with the vendors and shoppers necessary to complete a
          transaction.
        </li>
        <li>
          <strong>With service providers.</strong> We use trusted vendors for hosting, database,
          authentication, payments, and analytics (see below).
        </li>
        <li>
          <strong>For legal reasons.</strong> We may disclose information when required by law,
          regulation, legal process, or to protect the rights, safety, and property of {BRAND_NAME},
          our users, or others.
        </li>
        <li>
          <strong>Business transfers.</strong> If we are involved in a merger, acquisition, or
          sale of assets, information may be transferred as part of that transaction.
        </li>
      </ul>
      <p>
        <strong>We do not sell your personal information.</strong>
      </p>

      <h2 id="service-providers">Service Providers</h2>
      <p>
        We rely on third parties to operate the Service. These providers process data on our
        behalf under their own privacy practices:
      </p>
      <ul>
        <li><strong>Supabase</strong> — authentication, database, and file storage</li>
        <li><strong>Square</strong> — point-of-sale and payment processing for participating vendors</li>
        <li><strong>Map and tile providers</strong> — to display maps and market locations</li>
        <li><strong>Analytics and error-monitoring tools</strong> — to keep the Service reliable</li>
      </ul>

      <h2 id="your-rights">Your Rights and Choices</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you</li>
        <li>Correct inaccurate or incomplete information</li>
        <li>Delete your account and associated data</li>
        <li>Export a copy of your data</li>
        <li>Opt out of marketing communications</li>
      </ul>
      <p>
        You can update most profile details directly in the app. To delete your account, use the
        account deletion option in settings or email us at{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We will honor verified requests as
        required by applicable law, including the GDPR and CCPA/CPRA.
      </p>

      <h2 id="retention">Data Retention</h2>
      <p>
        We retain your information while your account is active and as needed to provide the
        Service. After you request deletion, we remove your personal data within 30 days, except
        where we must retain certain records to comply with legal, tax, accounting, or fraud-
        prevention obligations.
      </p>

      <h2 id="security">Security</h2>
      <p>
        We use administrative, technical, and physical safeguards designed to protect your
        information. No method of transmission or storage is completely secure, so we cannot
        guarantee absolute security. Please use a strong, unique password and keep your
        credentials confidential.
      </p>

      <h2 id="children">Children&apos;s Privacy</h2>
      <p>
        The Service is not directed to children under 13 (or the minimum age required in your
        jurisdiction), and we do not knowingly collect personal information from them. If you
        believe a child has provided us with personal information, please contact us so we can
        delete it.
      </p>

      <h2 id="changes">Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we
        will update the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you
        by email or an in-app notice.
      </p>

      <h2 id="contact">Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or how we handle your information, contact
        us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. For general support, reach
        us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
