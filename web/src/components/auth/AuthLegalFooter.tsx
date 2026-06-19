import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import '@/components/ui/ui.css';

interface AuthLegalFooterProps {
  showConsent?: boolean;
  consentAccepted?: boolean;
  onConsentChange?: (accepted: boolean) => void;
}

export function AuthLegalFooter({
  showConsent = false,
  consentAccepted = false,
  onConsentChange,
}: AuthLegalFooterProps) {
  const termsUrl = getTermsOfServiceUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {showConsent ? (
        <label className="auth-consent" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => onConsentChange?.(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span className="app-row-meta" style={{ lineHeight: 1.5 }}>
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
      ) : (
        <p className="app-row-meta" style={{ textAlign: 'center', lineHeight: 1.5 }}>
          By continuing, you agree to our{' '}
          <a href={termsUrl} target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
      )}
    </div>
  );
}
