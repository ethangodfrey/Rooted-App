import { NextResponse } from 'next/server';

import type { PosAnalyticsApiResponse, PosAnalyticsTransactionRow } from '@/lib/analytics/types';
import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import { fetchVendorForUser } from '@/lib/integration/pos-connections-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANGE_DAYS = 30;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function supabaseServiceConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * GET /api/analytics?vendorId=<uuid>
 *
 * Returns the last 30 days of pos_analytics_transactions for the vendor,
 * sorted chronologically by transaction_created_at.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim() ?? '';
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId query parameter is required' }, { status: 400 });
  }
  if (!UUID_RE.test(vendorId)) {
    return NextResponse.json({ error: 'vendorId must be a valid UUID' }, { status: 400 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token is required' }, { status: 401 });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const vendor = await fetchVendorForUser(vendorId, identity.id);
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found for this user' }, { status: 403 });
  }

  const config = supabaseServiceConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 },
    );
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RANGE_DAYS);
  const sinceIso = since.toISOString();

  const params = new URLSearchParams({
    vendor_id: `eq.${vendorId}`,
    transaction_created_at: `gte.${sinceIso}`,
    select:
      'id,total_amount_cents,tax_amount_cents,tip_amount_cents,payment_status,transaction_created_at',
    order: 'transaction_created_at.asc',
  });

  const res = await fetch(`${config.url}/rest/v1/pos_analytics_transactions?${params.toString()}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `Failed to load analytics transactions: ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const payload = (await res.json()) as unknown;
  const transactions = Array.isArray(payload)
    ? (payload as PosAnalyticsTransactionRow[])
    : [];

  const body: PosAnalyticsApiResponse = {
    vendorId,
    rangeDays: RANGE_DAYS,
    transactions,
  };

  return NextResponse.json(body);
}
