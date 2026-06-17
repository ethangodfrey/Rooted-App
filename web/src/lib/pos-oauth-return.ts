import { getAppOrigin } from '@/lib/auth-redirect';

/** URL the backend redirects to after Square OAuth completes. */
export function getPosOAuthReturnUrl(): string {
  return `${getAppOrigin()}/vendor/pos/connected`;
}
