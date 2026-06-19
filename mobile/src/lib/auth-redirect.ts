import type { AuthRouteCache } from '@/src/lib/auth-route-cache';
import type { Shopper, User, Vendor } from '@/src/types/database';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';
import * as Linking from 'expo-linking';

export type AuthRedirectHref =
  | '/intro'
  | '/(onboarding)/role-select'
  | '/(onboarding)/interests'
  | '/(shopper)/(tabs)/home'
  | '/(vendor)/profile/setup'
  | '/(vendor)/(tabs)/dashboard'
  | '/(admin)/(tabs)/vendors'
  | '/(auth)/login';

function getConfiguredHostedRedirectUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  return url || null;
}

export function getAuthRedirectUrl(): string {
  return getConfiguredHostedRedirectUrl() ?? Linking.createURL('/auth/callback');
}

export function getPasswordResetRedirectUrl(): string {
  return getConfiguredHostedRedirectUrl() ?? Linking.createURL('/auth/reset-password');
}

export function getHostedAuthRedirectUrl(): string | null {
  return getConfiguredHostedRedirectUrl();
}

export function getAuthRedirectUrlForDisplay(): string {
  return getAuthRedirectUrl();
}

export function resolveAuthRedirect(
  user: User | null,
  shopper: Shopper | null,
  vendor: Vendor | null,
  cache: AuthRouteCache | null,
  sessionUserId: string | null,
): AuthRedirectHref | null {
  const trustedCache =
    cache && sessionUserId && cache.userId === sessionUserId ? cache : null;

  const role = user?.role ?? trustedCache?.role ?? null;

  if (!role) {
    if (user) return '/(onboarding)/role-select';
    if (trustedCache) return '/(onboarding)/role-select';
    return null;
  }

  if (role === 'shopper') {
    const hasInterests = user
      ? (shopper?.interests?.length ?? 0) > 0
      : (trustedCache?.hasInterests ?? false);
    return hasInterests ? '/(shopper)/(tabs)/home' : '/(onboarding)/interests';
  }

  if (role === 'vendor') {
    const complete = user
      ? isVendorApplicationComplete(vendor)
      : (trustedCache?.vendorComplete ?? false);
    return complete ? '/(vendor)/(tabs)/dashboard' : '/(vendor)/profile/setup';
  }

  if (role === 'admin') {
    return '/(admin)/(tabs)/vendors';
  }

  return '/(auth)/login';
}
