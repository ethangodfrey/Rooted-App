export type StripeConnectStatus = {
  STATUS?: string;
  VENDOR_ID?: string;
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  marketplacePayoutsEnabled: boolean;
};

export type StripeConnectOnboardResult = {
  STATUS?: string;
  VENDOR_ID?: string;
  url: string;
  accountId: string;
  expiresAt: number;
};

export async function fetchStripeConnectStatus(options: {
  accessToken: string;
  apiBaseUrl?: string;
}): Promise<StripeConnectStatus> {
  const { accessToken, apiBaseUrl = '' } = options;
  const res = await fetch(`${apiBaseUrl}/api/stripe/connect/status`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  const body = (await res.json()) as StripeConnectStatus & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      body.error || body.message || `STRIPE_CONNECT_STATUS_HTTP_${res.status}`,
    );
  }
  return body;
}

export async function startStripeConnectOnboarding(options: {
  accessToken: string;
  apiBaseUrl?: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<StripeConnectOnboardResult> {
  const { accessToken, apiBaseUrl = '', returnUrl, refreshUrl } = options;
  const res = await fetch(`${apiBaseUrl}/api/stripe/connect/onboard`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ returnUrl, refreshUrl }),
    cache: 'no-store',
  });
  const body = (await res.json()) as StripeConnectOnboardResult & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      body.error || body.message || `STRIPE_CONNECT_ONBOARD_HTTP_${res.status}`,
    );
  }
  return body;
}
