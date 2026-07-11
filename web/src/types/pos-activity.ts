export type PosActivityFeedKind = 'inventory_adjustment' | 'pos_sale' | 'sync_run';

export interface PosActivityFeedItem {
  id: string;
  kind: PosActivityFeedKind;
  message: string;
  productName: string | null;
  eventName: string | null;
  provider: string | null;
  quantity: number | null;
  stockLevel: number | null;
  occurredAt: string;
}

export interface PosLowStockAlert {
  productId: string;
  productName: string;
  eventId: string;
  eventName: string;
  quantityRemaining: number;
  provider: string | null;
  lastChangeAt: string;
}

export interface PosActivityDashboardMetrics {
  windowHours: number;
  totalSyncsProcessed: number;
  inventorySyncEvents: number;
  transactionSyncRuns: number;
  activePosTerminals: number;
  lowStockAlertCount: number;
  queueLatencyMs: number | null;
  queueLatencySampleSize: number;
  lastUpdatedAt: string;
}

export interface PosActivityDashboardResponse {
  metrics: PosActivityDashboardMetrics;
  lowStockAlerts: PosLowStockAlert[];
  feed: PosActivityFeedItem[];
}
