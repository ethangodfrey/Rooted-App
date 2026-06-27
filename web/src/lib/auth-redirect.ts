import type { AuthRouteCache } from '@/lib/auth-route-cache';
import { isChefProfileComplete } from '@/lib/chef-profile';
import { isVendorApplicationComplete } from '@/lib/vendor-application';
import type { Chef, Shopper, User, Vendor } from '@/types/database';

export type AuthRedirectPath =
  | '/login'
  | '/onboarding/role-select'
  | '/onboarding/interests'
  | '/shopper/home'
  | '/vendor/setup'
  | '/vendor/dashboard'
  | '/chef/setup'
  | '/chef/dashboard'
  | '/admin/vendors';

export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    // In dev, always match the browser origin so OAuth redirect URLs stay valid.
    if (import.meta.env.DEV) {
      return window.location.origin;
    }
  }

  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getAuthRedirectUrl(): string {
  return `${getAppOrigin()}/auth/callback`;
}

export function getPasswordResetRedirectUrl(): string {
  return `${getAppOrigin()}/auth/reset-password`;
}

export function getAuthRedirectUrlForDisplay(): string {
  return getAuthRedirectUrl();
}

export function resolveAuthRedirect(
  user: User | null,
  shopper: Shopper | null,
  vendor: Vendor | null,
  chef: Chef | null,
  cache: AuthRouteCache | null,
  sessionUserId: string | null,
): AuthRedirectPath | null {
  const trustedCache =
    cache && sessionUserId && cache.userId === sessionUserId ? cache : null;

  const role = user?.role ?? trustedCache?.role ?? null;

  if (!role) {
    if (user || trustedCache) return '/onboarding/role-select';
    return null;
  }

  if (role === 'shopper' || role === 'customer') {
    const hasInterests = user
      ? (shopper?.interests?.length ?? 0) > 0
      : (trustedCache?.hasInterests ?? false);
    return hasInterests ? '/shopper/home' : '/onboarding/interests';
  }

  if (role === 'vendor') {
    const complete = user
      ? isVendorApplicationComplete(vendor)
      : (trustedCache?.vendorComplete ?? false);
    return complete ? '/vendor/dashboard' : '/vendor/setup';
  }

  if (role === 'chef') {
    const complete = user
      ? isChefProfileComplete(chef)
      : (trustedCache?.chefComplete ?? false);
    return complete ? '/chef/dashboard' : '/chef/setup';
  }

  if (role === 'admin') {
    return '/admin/vendors';
  }

  return '/login';
}
