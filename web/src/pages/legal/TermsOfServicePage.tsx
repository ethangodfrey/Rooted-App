import { LegalLayout } from './LegalLayout';
import { BRAND_NAME, SUPPORT_EMAIL } from './legal-config';

export function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" documentTitle={`Terms of Service — ${BRAND_NAME}`}>
      <p className="legal-intro">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the{' '}
        {BRAND_NAME} marketplace, including our website and mobile apps (collectively, the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these
        Terms. If you do not agree, do not use the Service.
      </p>

      <nav className="legal-toc" aria-label="Table of contents">
        <h2>On this page</h2>
        <ol>
          <li><a href="#eligibility">Eligibility &amp; accounts</a></li>
          <li><a href="#marketplace-role">Our role in the marketplace</a></li>
          <li><a href="#vendors">Vendor obligations</a></li>
          <li><a href="#shoppers">Shopper obligations</a></li>
          <li><a href="#orders">Orders, reservations &amp; payments</a></li>
          <li><a href="#content">Your content</a></li>
          <li><a href="#reviews">Reviews &amp; communications</a></li>
          <li><a href="#prohibited">Prohibited conduct</a></li>
          <li><a href="#ip">Intellectual property</a></li>
          <li><a href="#disclaimers">Disclaimers</a></li>
          <li><a href="#liability">Limitation of liability</a></li>
          <li><a href="#indemnification">Indemnification</a></li>
          <li><a href="#termination">Termination</a></li>
          <li><a href="#disputes">Governing law &amp; disputes</a></li>
          <li><a href="#changes">Changes to these Terms</a></li>
          <li><a href="#contact">Contact us</a></li>
        </ol>
      </nav>

      <h2 id="eligibility">Eligibility &amp; Accounts</h2>
      <p>
        You must be at least 18 years old (or the age of majority in your jurisdiction) to use the
        Service. You are responsible for the information you provide, for keeping your login
        credentials secure, and for all activity that occurs under your account. Notify us
        promptly of any unauthorized use.
      </p>

      <h2 id="marketplace-role">Our Role in the Marketplace</h2>
      <p>
        {BRAND_NAME} is a venue that connects shoppers with independent vendors and local markets.
        Vendors are independent sellers, not employees or agents of {BRAND_NAME}. We do not grow,
        prepare, produce, inspect, or sell vendor products, and we are not a party to the
        transactions between shoppers and vendors. We do not guarantee the quality, safety,
        legality, or availability of any product or listing.
      </p>

      <h2 id="vendors">Vendor Obligations</h2>
      <p>If you use the Service as a vendor, you agree to:</p>
      <ul>
        <li>Provide accurate listings, pricing, availability, and pickup information</li>
        <li>Comply with all applicable laws, including food-safety, labeling, cottage-food, licensing, and tax requirements</li>
        <li>Hold and maintain any permits, certifications, or insurance your products require</li>
        <li>Honor confirmed reservations and orders, and communicate promptly with shoppers</li>
        <li>Be solely responsible for the products you sell and any claims arising from them</li>
      </ul>

      <h2 id="shoppers">Shopper Obligations</h2>
      <p>If you use the Service as a shopper, you agree to:</p>
      <ul>
        <li>Provide accurate information when placing reservations or orders</li>
        <li>Pay for items you purchase and pick them up as arranged</li>
        <li>Follow each vendor&apos;s cancellation, pickup, and refund policies</li>
        <li>Treat vendors and market staff respectfully</li>
      </ul>

      <h2 id="orders">Orders, Reservations &amp; Payments</h2>
      <p>
        Placing a reservation or order creates an agreement directly between you and the vendor.
        Vendors set their own prices, availability, and policies. Some payments are processed by
        third-party providers such as Square; your use of those services is subject to their terms.
        Refunds, exchanges, and cancellations are handled according to the applicable vendor&apos;s
        policy and applicable law.
      </p>

      <h2 id="content">Your Content</h2>
      <p>
        You retain ownership of the content you submit (such as photos, posts, and profile
        details). You grant {BRAND_NAME} a worldwide, non-exclusive, royalty-free license to host,
        store, display, reproduce, and distribute that content solely to operate, promote, and
        improve the Service. You represent that you have the rights necessary to grant this
        license and that your content does not violate any law or third-party rights.
      </p>

      <h2 id="reviews">Reviews &amp; Communications</h2>
      <p>
        If the Service offers reviews or messaging, you agree to provide honest, firsthand
        feedback and to use communications features only for legitimate, transaction-related
        purposes. We may moderate, screen, or remove content that violates these Terms.
      </p>

      <h2 id="prohibited">Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate any law or the rights of others</li>
        <li>Post false, misleading, fraudulent, or infringing content</li>
        <li>Sell prohibited, unsafe, or recalled items</li>
        <li>Harass, abuse, threaten, or impersonate others</li>
        <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service</li>
        <li>Scrape, reverse engineer, or misuse the Service or its data</li>
      </ul>

      <h2 id="ip">Intellectual Property</h2>
      <p>
        The Service, including its software, design, logos, and content (excluding user content),
        is owned by {BRAND_NAME} or its licensors and is protected by intellectual-property laws.
        We grant you a limited, revocable, non-transferable license to use the Service for its
        intended purpose. All rights not expressly granted are reserved.
      </p>

      <h2 id="disclaimers">Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
        warranties of any kind, whether express or implied, including warranties of
        merchantability, fitness for a particular purpose, and non-infringement. We do not warrant
        that the Service will be uninterrupted, secure, or error-free, or that products offered by
        vendors will meet your expectations.
      </p>

      <h2 id="liability">Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {BRAND_NAME} and its affiliates will not be liable
        for any indirect, incidental, special, consequential, or punitive damages, or for any loss
        of profits, data, or goodwill, arising out of or related to your use of the Service. Our
        total liability for any claim relating to the Service will not exceed the greater of the
        amounts you paid to {BRAND_NAME} in the twelve months before the claim or USD $100.
      </p>

      <h2 id="indemnification">Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless {BRAND_NAME} and its affiliates from any claims,
        damages, liabilities, and expenses (including reasonable legal fees) arising from your use
        of the Service, your content, your products, or your violation of these Terms or applicable
        law.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate your access if you violate these Terms, create risk or legal exposure for us, or
        for any other reason permitted by law. Sections that by their nature should survive
        termination will continue to apply.
      </p>

      <h2 id="disputes">Governing Law &amp; Disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which {BRAND_NAME} operates,
        without regard to conflict-of-law rules. You agree to first attempt to resolve any dispute
        with us informally by contacting us. If a dispute cannot be resolved informally, it will be
        handled by the courts or dispute-resolution process designated in our governing-law
        jurisdiction, to the extent permitted by applicable law.
      </p>

      <h2 id="changes">Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we make material changes, we will update
        the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you. Your
        continued use of the Service after changes take effect means you accept the revised Terms.
      </p>

      <h2 id="contact">Contact Us</h2>
      <p>
        Questions about these Terms? Contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
