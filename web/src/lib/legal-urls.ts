export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://rooted.app';
}

export function getPrivacyPolicyUrl(): string {
  return `${getAppOrigin()}/privacy`;
}

export function getTermsOfServiceUrl(): string {
  return `${getAppOrigin()}/terms`;
}

export function getSupportUrl(): string {
  return `${getAppOrigin()}/support`;
}
