/**
 * Sales webhook router — provider dispatch (scaffold).
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md §3
 */

import type { PosIntegrationProvider } from '@/lib/integration/types';
import { isPosIntegrationProvider } from '@/lib/integration/types';

import type { ParsedSalesWebhook } from './types';

const SALES_PROVIDERS = new Set<PosIntegrationProvider>(['square', 'toast', 'clover']);

export function resolveSalesProvider(request: Request): PosIntegrationProvider | null {
  const fromQuery = new URL(request.url).searchParams.get('provider')?.trim().toLowerCase();
  if (fromQuery && isPosIntegrationProvider(fromQuery)) return fromQuery;

  const fromHeader = request.headers.get('x-pos-provider')?.trim().toLowerCase();
  if (fromHeader && isPosIntegrationProvider(fromHeader)) return fromHeader;

  if (request.headers.get('x-square-hmacsha256-signature')) return 'square';
  if (request.headers.get('toast-signature')) return 'toast';
  if (request.headers.get('x-clover-auth') || request.headers.get('x-clover-signature')) {
    return 'clover';
  }

  return null;
}

export function isSupportedSalesProvider(
  provider: PosIntegrationProvider,
): provider is PosIntegrationProvider {
  return SALES_PROVIDERS.has(provider);
}

/**
 * Parse and verify a sales webhook. Provider modules fill in signature + payload logic.
 */
export async function parseSalesWebhook(
  provider: PosIntegrationProvider,
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<ParsedSalesWebhook | null> {
  switch (provider) {
    case 'square': {
      const { parseSquareSalesWebhook } = await import('./providers/square');
      return parseSquareSalesWebhook(rawBody, headers);
    }
    case 'toast': {
      const { parseToastSalesWebhook } = await import('./providers/toast');
      return parseToastSalesWebhook(rawBody, headers);
    }
    case 'clover': {
      const { parseCloverSalesWebhook } = await import('./providers/clover');
      return parseCloverSalesWebhook(rawBody, headers);
    }
    default:
      return null;
  }
}
