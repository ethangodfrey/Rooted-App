function getWebAppOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : '';
}

export function getPrivacyPolicyUrl(): string {
  const configured = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
  if (configured) return configured;
  const origin = getWebAppOrigin();
  return origin ? `${origin}/privacy` : 'https://rooted.app/privacy';
}

export function getTermsOfServiceUrl(): string {
  const configured = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
  if (configured) return configured;
  const origin = getWebAppOrigin();
  return origin ? `${origin}/terms` : 'https://rooted.app/terms';
}

export function getSupportUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim();
  if (configured) return configured;
  const origin = getWebAppOrigin();
  return origin ? `${origin}/support` : 'https://rooted.app/support';
}
