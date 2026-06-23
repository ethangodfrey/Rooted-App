import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal';

export function AuthLegalNotice() {
  const termsUrl = getTermsOfServiceUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  return (
    <p className="app-row-meta" style={{ marginTop: '1rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>
      By creating an account, you agree to our{' '}
      <a href={termsUrl} target="_blank" rel="noopener noreferrer">
        Terms of Service
      </a>{' '}
      and{' '}
      <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </a>
      .
    </p>
  );
}
