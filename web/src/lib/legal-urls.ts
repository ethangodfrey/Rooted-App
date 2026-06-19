function resolveWebBaseUrl(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getPrivacyPolicyUrl(): string {
  const configured = import.meta.env.VITE_PRIVACY_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/privacy` : '/privacy';
}

export function getTermsOfServiceUrl(): string {
  const configured = import.meta.env.VITE_TERMS_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/terms` : '/terms';
}

export function getSupportUrl(): string {
  const configured = import.meta.env.VITE_SUPPORT_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/support` : 'mailto:support@rooted.app';
}
