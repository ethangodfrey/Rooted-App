import type { Session } from '@supabase/supabase-js';

import type { AuthRouteCache } from '@/src/lib/auth-route-cache';
import { isChefProfileComplete } from '@/src/lib/chef-profile';
import { isCustomerRole } from '@/src/lib/role-utils';
import type { Chef, Shopper, User, Vendor } from '@/src/types/database';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';
import * as Linking from 'expo-linking';

export type AuthRedirectHref =
  | '/intro'
  | '/auth/reset-password'
  | '/(onboarding)/role-select'
  | '/(onboarding)/interests'
  | '/(shopper)/(tabs)/home'
  | '/(vendor)/profile/setup'
  | '/(vendor)/(tabs)/dashboard'
  | '/(chef)/profile/setup'
  | '/(chef)/(tabs)/dashboard'
  | '/(admin)/(tabs)/vendors'
  | '/(auth)/login';

export function getHostedAuthRedirectUrl(): string | null {
  const hosted = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  return hosted || null;
}

export function getAuthRedirectUrl(): string {
  return getHostedAuthRedirectUrl() ?? Linking.createURL('/auth/callback');
}

export function getPasswordResetRedirectUrl(): string {
  return getHostedAuthRedirectUrl() ?? Linking.createURL('/auth/reset-password');
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
): AuthRedirectHref | null {
  const trustedCache =
    cache && sessionUserId && cache.userId === sessionUserId ? cache : null;

  const role = user?.role ?? trustedCache?.role ?? null;

  if (!role) {
    if (user) return '/(onboarding)/role-select';
    if (trustedCache) return '/(onboarding)/role-select';
    return null;
  }

  if (isCustomerRole(role)) {
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

  if (role === 'chef') {
    const complete = user
      ? isChefProfileComplete(chef)
      : (trustedCache?.chefComplete ?? false);
    return complete ? '/(chef)/(tabs)/dashboard' : '/(chef)/profile/setup';
  }

  if (role === 'admin') {
    return '/(admin)/(tabs)/vendors';
  }

  return '/(auth)/login';
}

export type IndexRedirectResult = AuthRedirectHref | 'loading';

export function resolveIndexRedirect(input: {
  isSupabaseConfigured: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  session: Session | null;
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  chef: Chef | null;
  isProfileLoading: boolean;
  cacheReady: boolean;
  trustedCache: AuthRouteCache | null;
}): IndexRedirectResult {
  if (!input.isSupabaseConfigured) return '/intro';
  if (input.isLoading) return 'loading';
  if (input.isPasswordRecovery) return '/auth/reset-password';
  if (!input.session) return '/intro';

  if (
    !input.user &&
    !input.trustedCache &&
    (input.isProfileLoading || !input.cacheReady)
  ) {
    return 'loading';
  }

  if (!input.user && !input.trustedCache) {
    return '/(onboarding)/role-select';
  }

  return (
    resolveAuthRedirect(
      input.user,
      input.shopper,
      input.vendor,
      input.chef,
      input.trustedCache,
      input.session.user.id,
    ) ?? '/(onboarding)/role-select'
  );
}
