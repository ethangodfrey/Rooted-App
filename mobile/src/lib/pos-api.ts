import { api } from './api';
import type {
  CreateConnectionResponse,
  ImportedTransactionsResponse,
  PosConnection,
  PosImportedLineItem,
  PosImportedTransaction,
  PosOAuthRedirectInfo,
  PosProductMapping,
  PosProvider,
  PosSyncRun,
} from '@/src/types/pos';

function normalizeLineItem(raw: Record<string, unknown>): PosImportedLineItem {
  const product = raw.product as { id: string; name: string } | null | undefined;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Register item'),
    quantity: Number(raw.quantity ?? 1),
    grossAmount: Number(raw.grossAmount ?? raw.gross_amount ?? 0),
    productId: (raw.productId ?? raw.product_id ?? null) as string | null | undefined,
    product: product ?? null,
    itemType: (raw.itemType ?? raw.item_type ?? undefined) as string | undefined,
  };
}

function normalizeTransaction(raw: Record<string, unknown>): PosImportedTransaction {
  const lineItemsRaw = (raw.lineItems ?? raw.line_items ?? []) as Record<string, unknown>[];
  return {
    id: String(raw.id),
    soldAt: String(raw.soldAt ?? raw.sold_at),
    currency: String(raw.currency ?? 'USD'),
    grossAmount: Number(raw.grossAmount ?? raw.gross_amount ?? 0),
    netAmount: Number(raw.netAmount ?? raw.net_amount ?? 0),
    state: String(raw.state ?? 'COMPLETED'),
    tenderType: (raw.tenderType ?? raw.tender_type ?? null) as string | null | undefined,
    cardBrand: (raw.cardBrand ?? raw.card_brand ?? null) as string | null | undefined,
    lineItems: lineItemsRaw.map(normalizeLineItem),
  };
}

export const posApi = {
  listConnections: () => api.get<PosConnection[]>('/pos/connections'),

  getConnection: (id: string) => api.get<PosConnection>(`/pos/connections/${id}`),

  createConnection: (provider: PosProvider, appReturnUrl?: string) =>
    api.post<CreateConnectionResponse>('/pos/connections', {
      provider,
      ...(appReturnUrl ? { appReturnUrl } : {}),
    }),

  getOAuthRedirectUri: (provider: PosProvider) =>
    api.get<PosOAuthRedirectInfo>(`/pos/oauth/${provider.toLowerCase()}/redirect-uri`),

  disconnect: (id: string) => api.del<PosConnection>(`/pos/connections/${id}`),

  registerWebhook: (id: string) => api.post<PosConnection>(`/pos/connections/${id}/webhook`),

  triggerSync: (id: string, body?: { backfill?: boolean }) =>
    api.post<{ syncRunId: string; status: string }>(`/pos/connections/${id}/sync`, body ?? {}),

  listSyncRuns: (id: string) => api.get<PosSyncRun[]>(`/pos/connections/${id}/sync-runs`),

  listMappings: () => api.get<PosProductMapping[]>('/pos/mappings/products'),

  upsertMapping: (body: {
    connectionId: string;
    providerCatalogObjectId: string;
    productId?: string | null;
    ignored?: boolean;
  }) => api.put<PosProductMapping>('/pos/mappings/products', body),

  transactions: (params?: { since?: string; until?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.since) qs.set('since', params.since);
    if (params?.until) qs.set('until', params.until);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<ImportedTransactionsResponse>(`/pos/transactions${suffix}`).then((res) => ({
      total: res.total,
      items: (res.items as unknown as Record<string, unknown>[]).map(normalizeTransaction),
    }));
  },
};
