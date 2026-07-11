import { getAuthRedirectUrl } from '@/src/lib/auth-redirect';

export type OAuthProvider = 'google' | 'apple';

export type OAuthSetupStep = {
  label: string;
  detail: string;
};

type SupabaseAuthErrorBody = {
  msg?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
  message?: string;
};

export class OAuthConfigError extends Error {
  readonly setupSteps: OAuthSetupStep[];

  constructor(message: string, setupSteps: OAuthSetupStep[] = []) {
    super(message);
    this.name = 'OAuthConfigError';
    this.setupSteps = setupSteps;
  }
}

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
};

export function getSupabaseCallbackUrl(supabaseUrl?: string): string {
  const host = supabaseUrl?.replace(/\/$/, '') ?? 'https://your-project.supabase.co';
  return `${host}/auth/v1/callback`;
}

export function getOAuthSetupSteps(
  provider: OAuthProvider,
  options?: { supabaseUrl?: string; appRedirectUrl?: string },
): OAuthSetupStep[] {
  const supabaseUrl = options?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const appRedirect = options?.appRedirectUrl ?? getAuthRedirectUrl();
  const supabaseCallback = getSupabaseCallbackUrl(supabaseUrl);
  const providerLabel = PROVIDER_LABELS[provider];

  return [
    {
      label: `Enable ${providerLabel} in Supabase`,
      detail: `Dashboard → Authentication → Providers → ${providerLabel} → Enable`,
    },
    {
      label: `Add ${providerLabel} OAuth credentials in Supabase`,
      detail: `Paste the Client ID and Client Secret from your ${providerLabel} developer console`,
    },
    {
      label: 'Allow this app redirect URL in Supabase',
      detail: `Dashboard → Authentication → URL Configuration → Redirect URLs → add ${appRedirect}`,
    },
    {
      label: `Register the Supabase callback in ${providerLabel}`,
      detail: `Authorized redirect URI must include ${supabaseCallback}`,
    },
  ];
}

export function providerNotEnabledMessage(provider?: OAuthProvider): string {
  if (provider) {
    const label = PROVIDER_LABELS[provider];
    return `${label} sign-in isn't enabled yet. Enable it in Supabase Dashboard → Authentication → Providers → ${label}.`;
  }
  return "This sign-in provider isn't enabled yet. Enable it in Supabase Dashboard → Authentication → Providers.";
}

function parseSupabaseErrorPayload(text: string): SupabaseAuthErrorBody | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed) as SupabaseAuthErrorBody;
  } catch {
    return null;
  }
}

function collectErrorText(...parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function isProviderNotEnabled(text: string, body?: SupabaseAuthErrorBody | null): boolean {
  const haystack = collectErrorText(
    text,
    body?.msg,
    body?.message,
    body?.error,
    body?.error_description,
  );

  return (
    haystack.includes('provider is not enabled') ||
    haystack.includes('unsupported provider') ||
    (body?.error_code === 'validation_failed' && haystack.includes('provider'))
  );
}

function messageFromBody(body: SupabaseAuthErrorBody | null, fallback: string): string {
  return body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? fallback;
}

/** Turn Supabase OAuth failures into user-friendly copy. */
export function formatOAuthError(error: unknown, provider?: OAuthProvider): string {
  if (error instanceof OAuthConfigError) return error.message;
  if (!error) return 'Could not complete sign-in.';

  if (typeof error === 'string') {
    const body = parseSupabaseErrorPayload(error);
    if (isProviderNotEnabled(error, body)) return providerNotEnabledMessage(provider);
    return messageFromBody(body, error);
  }

  if (error instanceof Error) {
    const body = parseSupabaseErrorPayload(error.message);
    if (isProviderNotEnabled(error.message, body)) return providerNotEnabledMessage(provider);
    return messageFromBody(body, error.message);
  }

  if (typeof error === 'object') {
    const obj = error as SupabaseAuthErrorBody;
    const text = [obj.msg, obj.message, obj.error, obj.error_description].filter(Boolean).join(' ');
    if (isProviderNotEnabled(text, obj)) return providerNotEnabledMessage(provider);
    return messageFromBody(obj, 'Could not complete sign-in.');
  }

  return 'Could not complete sign-in.';
}

/** Format OAuth error query/hash params from a callback URL. */
export function formatOAuthUrlError(
  error: string,
  errorDescription?: string,
  provider?: OAuthProvider,
): string {
  const combined = [error, errorDescription].filter(Boolean).join(' ');
  const body = parseSupabaseErrorPayload(combined) ?? parseSupabaseErrorPayload(errorDescription ?? error);
  if (isProviderNotEnabled(combined, body)) return providerNotEnabledMessage(provider);
  return messageFromBody(body, errorDescription ?? error);
}

export function formatOAuthAuthorizeFailure(
  provider: OAuthProvider,
  status: number,
  body: SupabaseAuthErrorBody,
): OAuthConfigError {
  const raw =
    body.msg ?? body.error_description ?? body.error ?? `OAuth authorize failed (${status})`;
  const lower = raw.toLowerCase();
  const setupSteps = getOAuthSetupSteps(provider);

  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return new OAuthConfigError(providerNotEnabledMessage(provider), setupSteps);
  }

  if (lower.includes('redirect') && (lower.includes('invalid') || lower.includes('not allowed'))) {
    return new OAuthConfigError(
      `OAuth redirect URL is not allowed by Supabase. Add ${getAuthRedirectUrl()} under Authentication → URL Configuration → Redirect URLs.`,
      setupSteps,
    );
  }

  return new OAuthConfigError(`Could not start ${provider} sign-in: ${raw}`, setupSteps);
}

export async function assertOAuthAuthorizeUrl(
  authorizeUrl: string,
  provider: OAuthProvider,
): Promise<void> {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const res = await fetch(authorizeUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location') ?? '';
    if (
      location.includes('accounts.google.com') ||
      location.includes('appleid.apple.com') ||
      location.includes('idmsa.apple.com')
    ) {
      return;
    }
  }

  if (res.ok) return;

  let body: SupabaseAuthErrorBody = {};
  try {
    body = (await res.json()) as SupabaseAuthErrorBody;
  } catch {
    // Non-JSON error page — fall through with empty body.
  }

  throw formatOAuthAuthorizeFailure(provider, res.status, body);
}
