function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : null;
}

/** Public web app origin for legal pages and support links. */
export function getWebAppOrigin(): string {
  return trimEnv(process.env.EXPO_PUBLIC_WEB_APP_URL) ?? 'https://rooted.app';
}

export function getPrivacyPolicyUrl(): string {
  return `${getWebAppOrigin()}/privacy`;
}

export function getTermsOfServiceUrl(): string {
  return `${getWebAppOrigin()}/terms`;
}

export function getSupportUrl(): string {
  return `${getWebAppOrigin()}/support`;
}
