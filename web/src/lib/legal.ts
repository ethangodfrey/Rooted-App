const DEFAULT_TERMS_URL = 'https://rooted.app/terms';
const DEFAULT_PRIVACY_URL = 'https://rooted.app/privacy';
const DEFAULT_SUPPORT_URL = 'https://rooted.app/support';

export function getTermsOfServiceUrl(): string {
  return import.meta.env.VITE_LEGAL_TERMS_URL?.trim() || DEFAULT_TERMS_URL;
}

export function getPrivacyPolicyUrl(): string {
  return import.meta.env.VITE_LEGAL_PRIVACY_URL?.trim() || DEFAULT_PRIVACY_URL;
}

export function getSupportUrl(): string {
  return import.meta.env.VITE_SUPPORT_URL?.trim() || DEFAULT_SUPPORT_URL;
}
