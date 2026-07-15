export const SQUARE_SANDBOX_SETUP_URL = 'https://developer.squareup.com/apps';

/** Square Developer Console — credentials / redirect URL setup only (not OAuth consent). */
export function openSquareSandboxSetup(): void {
  window.open(SQUARE_SANDBOX_SETUP_URL, '_blank', 'noopener,noreferrer');
}

export function getSquareAuthorizeHost(authorizeUrl: string): string | null {
  try {
    return new URL(authorizeUrl).hostname;
  } catch {
    return null;
  }
}

/** Reject URLs that are not Square authorize endpoints (e.g. Developer Console). */
export function assertSquareAuthorizeUrl(
  authorizeUrl: string,
  oauthEnvironment?: 'sandbox' | 'production',
): { ok: true; host: string } | { ok: false; error: string } {
  const host = getSquareAuthorizeHost(authorizeUrl);
  if (!host) {
    return { ok: false, error: 'Square returned an invalid authorization URL.' };
  }

  if (host === 'developer.squareup.com' || host === 'squareup.com') {
    return {
      ok: false,
      error:
        'Authorization URL pointed at the Square Developer Console instead of OAuth. Check SQUARE_APPLICATION_ID and SQUARE_ENVIRONMENT on Railway.',
    };
  }

  if (oauthEnvironment === 'sandbox' && host !== 'connect.squareupsandbox.com') {
    return {
      ok: false,
      error: `Sandbox OAuth must use connect.squareupsandbox.com (got ${host}). Check SQUARE_ENVIRONMENT on Railway.`,
    };
  }

  if (oauthEnvironment === 'production' && host !== 'connect.squareup.com') {
    return {
      ok: false,
      error: `Production OAuth must use connect.squareup.com (got ${host}).`,
    };
  }

  if (host !== 'connect.squareupsandbox.com' && host !== 'connect.squareup.com') {
    return {
      ok: false,
      error: `Unexpected Square OAuth host: ${host}`,
    };
  }

  return { ok: true, host };
}

export function openSquareOAuth(authorizeUrl: string): void {
  window.location.assign(authorizeUrl);
}
