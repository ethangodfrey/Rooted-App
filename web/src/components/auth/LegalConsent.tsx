import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import '@/components/ui/ui.css';

interface LegalConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function LegalConsent({ checked, onChange }: LegalConsentProps) {
  const privacyUrl = getPrivacyPolicyUrl();
  const termsUrl = getTermsOfServiceUrl();

  return (
    <label className="legal-consent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: '0.2rem' }}
      />
      <span>
        I agree to the{' '}
        <a href={termsUrl} target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}

export function LegalFooterLinks() {
  const privacyUrl = getPrivacyPolicyUrl();
  const termsUrl = getTermsOfServiceUrl();

  return (
    <p className="legal-footer-links">
      <a href={privacyUrl}>Privacy</a>
      <span aria-hidden="true"> · </span>
      <a href={termsUrl}>Terms</a>
    </p>
  );
}
