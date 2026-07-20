/**
 * Stripe Connect onboarding helpers.
 * Telemetry: STRIPE_ONBOARDING_ACTIVE, BANK_LINK_INITIALIZED
 */

export type OnboardingActorRole = 'vendor' | 'farmer';

export function formatStripeOnboardingActiveLog(input?: {
  role?: OnboardingActorRole;
  accountId?: string | null;
}): string {
  const parts = ['STRIPE_ONBOARDING_ACTIVE'];
  if (input?.role) parts.push(`ROLE=${input.role.toUpperCase()}`);
  if (input?.accountId) parts.push(`ACCOUNT=${input.accountId}`);
  return parts.join(' ');
}

export function formatBankLinkInitializedLog(input?: {
  role?: OnboardingActorRole;
  accountId?: string | null;
  action?: 'ONBOARD' | 'REFRESH';
}): string {
  const parts = ['BANK_LINK_INITIALIZED'];
  if (input?.action) parts.push(`ACTION=${input.action}`);
  if (input?.role) parts.push(`ROLE=${input.role.toUpperCase()}`);
  if (input?.accountId) parts.push(`ACCOUNT=${input.accountId}`);
  return parts.join(' ');
}

export function payoutsEnabledFromAccountId(
  stripeAccountId: string | null | undefined,
): boolean {
  return Boolean(stripeAccountId?.trim());
}

export function defaultOnboardingReturnPath(role: OnboardingActorRole): string {
  return role === 'farmer' ? '/farmer/logistics' : '/vendor/financials';
}
