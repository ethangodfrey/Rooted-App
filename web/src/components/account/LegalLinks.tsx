import { getPrivacyPolicyUrl, getSupportUrl, getTermsOfServiceUrl } from '@/lib/legal';

export function LegalLinks() {
  const links = [
    { label: 'Terms of Service', url: getTermsOfServiceUrl() },
    { label: 'Privacy Policy', url: getPrivacyPolicyUrl() },
    { label: 'Support', url: getSupportUrl() },
  ];

  return (
    <div className="legal-links" style={{ marginTop: '2rem', textAlign: 'center' }}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginTop: '0.5rem', color: 'var(--color-primary)', fontSize: '0.875rem' }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
