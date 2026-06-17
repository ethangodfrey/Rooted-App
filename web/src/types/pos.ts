export type PosProvider = 'SQUARE' | 'TOAST' | 'CLOVER';

export type PosConnectionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'ERROR'
  | 'EXPIRED'
  | 'DISCONNECTED';

export type PosSyncStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

export type PosSyncTrigger = 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'BACKFILL';

export interface PosConnection {
  id: string;
  vendorId: string;
  provider: PosProvider;
  authType: 'OAUTH' | 'API_KEY';
  status: PosConnectionStatus;
  displayName?: string | null;
  providerMerchantId?: string | null;
  providerLocationId?: string | null;
  lastSyncedAt?: string | null;
  syncFrequencyMinutes: number;
  errorMessage?: string | null;
  metadata?: { webhookSubscriptionId?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionResponse {
  connection: PosConnection;
  authorizeUrl?: string;
  oauthRedirectUri?: string;
  oauthEnvironment?: 'sandbox' | 'production';
}

export interface PosOAuthRedirectInfo {
  redirectUri: string;
  hint: string;
}

export interface PosSyncRun {
  id: string;
  trigger: PosSyncTrigger;
  status: PosSyncStatus;
  transactionsFetched: number;
  transactionsImported: number;
  transactionsSkipped: number;
  errorCount: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface PosProductMapping {
  id: string;
  connectionId: string;
  provider: PosProvider;
  providerCatalogObjectId: string;
  providerItemName?: string | null;
  productId?: string | null;
  autoMatched: boolean;
  ignored: boolean;
}

export interface PosImportedLineItem {
  id: string;
  name: string;
  quantity: number;
  grossAmount: number;
  productId?: string | null;
  product?: { id: string; name: string } | null;
  itemType?: string;
}

export interface PosImportedTransaction {
  id: string;
  soldAt: string;
  currency: string;
  grossAmount: number;
  netAmount: number;
  state: string;
  tenderType?: string | null;
  cardBrand?: string | null;
  lineItems: PosImportedLineItem[];
}

export interface ImportedTransactionsResponse {
  total: number;
  items: PosImportedTransaction[];
}
