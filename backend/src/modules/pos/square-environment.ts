/**
 * Normalize SQUARE_ENVIRONMENT from Railway/env.
 * Accepts `sandbox` | `production`, or accidental full authorize URLs people paste
 * into the env var (we saw connect.squareupsandbox.com/oauth2/authorize).
 */
export function normalizeSquareEnvironment(
  raw: string | undefined | null,
): 'sandbox' | 'production' {
  const value = (raw ?? 'sandbox').trim().toLowerCase();
  if (!value || value === 'sandbox' || value === 'development' || value === 'dev') {
    return 'sandbox';
  }
  if (value === 'production' || value === 'prod' || value === 'live') {
    return 'production';
  }
  if (value.includes('squareupsandbox.com') || value.includes('sandbox')) {
    return 'sandbox';
  }
  if (value.includes('squareup.com') && !value.includes('sandbox')) {
    return 'production';
  }
  return 'sandbox';
}

export function squareAuthorizeBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}
