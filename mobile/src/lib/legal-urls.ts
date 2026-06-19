function resolveWebBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return null;
}

export function getPrivacyPolicyUrl(): string {
  const configured = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/privacy` : 'https://rooted.app/privacy';
}

export function getTermsOfServiceUrl(): string {
  const configured = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/terms` : 'https://rooted.app/terms';
}

export function getSupportUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim();
  if (configured) return configured;
  const base = resolveWebBaseUrl();
  return base ? `${base}/support` : 'mailto:support@rooted.app';
}
