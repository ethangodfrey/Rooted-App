function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function getWebAppUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (configured) return trimTrailingSlash(configured);
  return 'https://rooted.app';
}

export function getPrivacyPolicyUrl(): string {
  return `${getWebAppUrl()}/privacy`;
}

export function getTermsOfServiceUrl(): string {
  return `${getWebAppUrl()}/terms`;
}

export function getSupportUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim();
  if (configured) return configured;
  return 'mailto:support@rooted.app';
}
