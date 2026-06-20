function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getPrivacyPolicyUrl(): string {
  const configured = import.meta.env.VITE_PRIVACY_URL?.trim();
  if (configured) return configured;
  const origin = getAppOrigin();
  return origin ? `${origin}/privacy` : '/privacy';
}

export function getTermsOfServiceUrl(): string {
  const configured = import.meta.env.VITE_TERMS_URL?.trim();
  if (configured) return configured;
  const origin = getAppOrigin();
  return origin ? `${origin}/terms` : '/terms';
}

export function getSupportUrl(): string {
  const configured = import.meta.env.VITE_SUPPORT_URL?.trim();
  if (configured) return configured;
  const origin = getAppOrigin();
  return origin ? `${origin}/support` : '/support';
}
