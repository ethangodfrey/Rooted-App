import { api } from '@/lib/api';

/**
 * Phase 6 Stripe Connect onboarding (vendor + farmer bank link).
 * Telemetry: STRIPE_ONBOARDING_ACTIVE, BANK_LINK_INITIALIZED
 */

export type PaymentsOnboardStatus = {
  STATUS: string;
  ROLE: string;
  ACTOR_ID: string;
  STRIPE_ACCOUNT_ID: string | null;
  PAYOUTS_ENABLED: boolean;
};

export type PaymentsOnboardResult = {
  STATUS: string;
  ACTION: string;
  ROLE: string;
  ACTOR_ID: string;
  ACCOUNT_ID: string;
  URL: string;
  EXPIRES_AT: number;
  url?: string;
  accountId?: string;
};

export async function fetchPaymentsOnboardStatus(): Promise<PaymentsOnboardStatus> {
  return api.get('/api/payments/onboard/status');
}

export async function startPaymentsOnboarding(urls?: {
  returnUrl?: string;
  refreshUrl?: string;
}): Promise<PaymentsOnboardResult> {
  return api.post('/api/payments/onboard', urls ?? {});
}

export async function refreshPaymentsOnboarding(urls?: {
  returnUrl?: string;
  refreshUrl?: string;
}): Promise<PaymentsOnboardResult> {
  const params = new URLSearchParams();
  if (urls?.returnUrl) params.set('returnUrl', urls.returnUrl);
  if (urls?.refreshUrl) params.set('refreshUrl', urls.refreshUrl);
  const qs = params.toString();
  return api.get(
    `/api/payments/onboard/refresh${qs ? `?${qs}` : ''}`,
  );
}

export function formatStripeOnboardingActiveLog(input?: {
  role?: string;
  accountId?: string | null;
}): string {
  const parts = ['STRIPE_ONBOARDING_ACTIVE'];
  if (input?.role) parts.push(`ROLE=${input.role.toUpperCase()}`);
  if (input?.accountId) parts.push(`ACCOUNT=${input.accountId}`);
  return parts.join(' ');
}

export function formatBankLinkInitializedLog(input?: {
  action?: string;
  role?: string;
}): string {
  const parts = ['BANK_LINK_INITIALIZED'];
  if (input?.action) parts.push(`ACTION=${input.action.toUpperCase()}`);
  if (input?.role) parts.push(`ROLE=${input.role.toUpperCase()}`);
  return parts.join(' ');
}
