function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function getWebAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://rooted.app';
}

export function getPrivacyPolicyUrl(): string {
  return `${getWebAppUrl()}/privacy`;
}

export function getTermsOfServiceUrl(): string {
  return `${getWebAppUrl()}/terms`;
}

export function getSupportUrl(): string {
  const configured = import.meta.env.VITE_SUPPORT_URL?.trim();
  if (configured) return configured;
  return 'mailto:support@rooted.app';
}
