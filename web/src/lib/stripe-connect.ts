import { api } from '@/lib/api';

export type PreorderPaymentPolicy = 'pickup_only' | 'stripe_only' | 'pickup_or_stripe';

export const PREORDER_PAYMENT_POLICY_OPTIONS: Array<{
  value: PreorderPaymentPolicy;
  label: string;
  description: string;
}> = [
  {
    value: 'stripe_only',
    label: 'Require Card Payment Upfront',
    description: 'Shoppers must pay online with Stripe before pickup.',
  },
  {
    value: 'pickup_only',
    label: 'Pay at Pickup Only',
    description: 'Reservations hold stock; shoppers pay at the booth (card, cash, or EBT).',
  },
  {
    value: 'pickup_or_stripe',
    label: 'Let Shopper Choose (Pay Now or Pay at Pickup)',
    description: 'Shoppers pick card-now or pay at the booth when they checkout.',
  },
];

export interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  marketplacePayoutsEnabled: boolean;
}

export interface StripeConnectOnboardResult {
  url: string;
  accountId: string;
  expiresAt: number;
}

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  return api.get<StripeConnectStatus>('/stripe/connect/status');
}

export async function startStripeConnectOnboarding(urls?: {
  returnUrl?: string;
  refreshUrl?: string;
}): Promise<StripeConnectOnboardResult> {
  return api.post<StripeConnectOnboardResult>('/stripe/connect/onboard', urls ?? {});
}

/** Resolve effective cart policy across multi-vendor baskets (strictest wins). */
export function resolveCartPaymentPolicy(
  policies: PreorderPaymentPolicy[],
): PreorderPaymentPolicy {
  if (policies.length === 0) return 'pickup_or_stripe';
  if (policies.every((p) => p === 'pickup_only')) return 'pickup_only';
  if (policies.every((p) => p === 'stripe_only')) return 'stripe_only';
  if (policies.some((p) => p === 'stripe_only') && policies.some((p) => p === 'pickup_only')) {
    // Conflicting vendors — force choice UI but prefer pickup as safer default path.
    return 'pickup_or_stripe';
  }
  return 'pickup_or_stripe';
}
