import { supabase } from '@/lib/supabase';

export type PosAnalyticsProvider = 'SQUARE' | 'TOAST' | 'STRIPE_NATIVE';
export type PosSalesSource = 'SQUARE' | 'TOAST' | 'STRIPE_NATIVE' | 'CASH_HANDOFF';

export type PosIntegration = {
  id: string;
  vendor_id: string;
  provider: PosAnalyticsProvider;
  credentials_connected: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoricalSalesMetric = {
  id: string;
  vendor_id: string;
  source: PosSalesSource;
  amount: number;
  recorded_at: string;
};

export type SourceBreakdownRow = {
  source: PosSalesSource;
  label: string;
  amount: number;
};

export type ProductVelocityRow = {
  name: string;
  units: number;
  revenue: number;
};

export type FulfillmentAnalytics = {
  completed: number;
  cancelled: number;
  pending: number;
  successRate: number;
};

export type PosTelemetrySuite = {
  totalGrossRevenue: number;
  activePreorderValue: number;
  totalSalesVolume: number;
  fulfillment: FulfillmentAnalytics;
  productVelocity: ProductVelocityRow[];
  sourceBreakdown: SourceBreakdownRow[];
  integrations: PosIntegration[];
};

export const POS_PROVIDER_CARDS: Array<{
  provider: PosAnalyticsProvider;
  title: string;
  subtitle: string;
}> = [
  {
    provider: 'SQUARE',
    title: 'SQUARE READER',
    subtitle: 'Sync Square Terminal and handheld reader sales into telemetry.',
  },
  {
    provider: 'TOAST',
    title: 'TOAST POS',
    subtitle: 'Import Toast restaurant POS tickets as historical sales metrics.',
  },
  {
    provider: 'STRIPE_NATIVE',
    title: 'STRIPE CONNECT',
    subtitle: 'Link Stripe Connect payouts with platform-native checkout revenue.',
  },
];

export const SOURCE_LABELS: Record<PosSalesSource, string> = {
  SQUARE: 'SQUARE TERMINAL',
  TOAST: 'TOAST',
  STRIPE_NATIVE: 'STRIPE NATIVE',
  CASH_HANDOFF: 'CASH HANDOFF',
};

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function emptySuite(): PosTelemetrySuite {
  return {
    totalGrossRevenue: 0,
    activePreorderValue: 0,
    totalSalesVolume: 0,
    fulfillment: { completed: 0, cancelled: 0, pending: 0, successRate: 0 },
    productVelocity: [],
    sourceBreakdown: (
      Object.keys(SOURCE_LABELS) as PosSalesSource[]
    ).map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      amount: 0,
    })),
    integrations: [],
  };
}

export async function fetchPosIntegrations(
  vendorId: string,
): Promise<PosIntegration[]> {
  const { data, error } = await supabase.rpc('ensure_pos_integration_rows', {
    p_vendor_id: vendorId,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return (data as PosIntegration[]).map(normalizeIntegration);
  }

  // Fallback when RPC is not applied yet — still attempt a direct read/upsert.
  const { data: existing, error: readError } = await supabase
    .from('pos_integrations')
    .select('id, vendor_id, provider, credentials_connected, last_sync_at, created_at, updated_at')
    .eq('vendor_id', vendorId)
    .order('provider');

  if (readError) throw new Error(readError.message);

  const rows = (existing ?? []) as PosIntegration[];
  if (rows.length > 0) return rows.map(normalizeIntegration);

  const seeds = POS_PROVIDER_CARDS.map((card) => ({
    vendor_id: vendorId,
    provider: card.provider,
    credentials_connected: false,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('pos_integrations')
    .upsert(seeds, { onConflict: 'vendor_id,provider' })
    .select('id, vendor_id, provider, credentials_connected, last_sync_at, created_at, updated_at');

  if (insertError) throw new Error(insertError.message);
  return ((inserted ?? []) as PosIntegration[]).map(normalizeIntegration);
}

export async function connectPosIntegration(
  vendorId: string,
  provider: PosAnalyticsProvider,
): Promise<PosIntegration> {
  const { data, error } = await supabase
    .from('pos_integrations')
    .upsert(
      {
        vendor_id: vendorId,
        provider,
        credentials_connected: true,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_id,provider' },
    )
    .select('id, vendor_id, provider, credentials_connected, last_sync_at, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return normalizeIntegration(data as PosIntegration);
}

export async function disconnectPosIntegration(
  vendorId: string,
  provider: PosAnalyticsProvider,
): Promise<PosIntegration> {
  const { data, error } = await supabase
    .from('pos_integrations')
    .upsert(
      {
        vendor_id: vendorId,
        provider,
        credentials_connected: false,
        last_sync_at: null,
      },
      { onConflict: 'vendor_id,provider' },
    )
    .select('id, vendor_id, provider, credentials_connected, last_sync_at, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return normalizeIntegration(data as PosIntegration);
}

export async function loadPosTelemetrySuite(
  vendorId: string,
): Promise<PosTelemetrySuite> {
  const suite = emptySuite();

  const [integrations, metricsResult, preordersResult] = await Promise.all([
    fetchPosIntegrations(vendorId).catch(() => [] as PosIntegration[]),
    supabase
      .from('historical_sales_metrics')
      .select('id, vendor_id, source, amount, recorded_at')
      .eq('vendor_id', vendorId)
      .order('recorded_at', { ascending: false })
      .limit(5000),
    supabase
      .from('preorder_orders')
      .select(
        'id, status, total_amount, items:preorder_order_items(quantity, unit_price, product:products(name))',
      )
      .eq('vendor_id', vendorId)
      .limit(2000),
  ]);

  suite.integrations = integrations;

  const bySource = new Map<PosSalesSource, number>();
  for (const source of Object.keys(SOURCE_LABELS) as PosSalesSource[]) {
    bySource.set(source, 0);
  }

  if (!metricsResult.error && metricsResult.data) {
    for (const row of metricsResult.data as HistoricalSalesMetric[]) {
      const amount = Number(row.amount) || 0;
      bySource.set(row.source, (bySource.get(row.source) ?? 0) + amount);
      suite.totalGrossRevenue += amount;
      suite.totalSalesVolume += 1;
    }
  }

  const productMap = new Map<string, ProductVelocityRow>();

  if (!preordersResult.error && preordersResult.data) {
    let completed = 0;
    let cancelled = 0;
    let pending = 0;

    for (const row of preordersResult.data as Array<{
      status: string;
      total_amount: number | string;
      items:
        | Array<{
            quantity: number;
            unit_price: number | string;
            product: { name: string } | { name: string }[] | null;
          }>
        | null;
    }>) {
      const amount = Number(row.total_amount) || 0;
      if (row.status === 'COMPLETED') {
        completed += 1;
        suite.totalGrossRevenue += amount;
        suite.totalSalesVolume += 1;
        bySource.set(
          'STRIPE_NATIVE',
          (bySource.get('STRIPE_NATIVE') ?? 0) + amount,
        );
      } else if (row.status === 'CANCELLED') {
        cancelled += 1;
      } else if (row.status === 'PENDING_PICKUP') {
        pending += 1;
        suite.activePreorderValue += amount;
      }

      if (row.status === 'CANCELLED') continue;
      for (const item of row.items ?? []) {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        const name = product?.name?.trim() || 'UNNAMED PRODUCT';
        const units = Number(item.quantity) || 0;
        const revenue = units * (Number(item.unit_price) || 0);
        const existing = productMap.get(name);
        if (existing) {
          existing.units += units;
          existing.revenue += revenue;
        } else {
          productMap.set(name, { name, units, revenue });
        }
      }
    }

    const decided = completed + cancelled;
    suite.fulfillment = {
      completed,
      cancelled,
      pending,
      successRate:
        decided === 0 ? 0 : Math.round((completed / decided) * 1000) / 10,
    };
  }

  suite.productVelocity = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 12);

  suite.sourceBreakdown = (Object.keys(SOURCE_LABELS) as PosSalesSource[])
    .map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      amount: bySource.get(source) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return suite;
}

function normalizeIntegration(row: PosIntegration): PosIntegration {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    provider: row.provider,
    credentials_connected: Boolean(row.credentials_connected),
    last_sync_at: row.last_sync_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
