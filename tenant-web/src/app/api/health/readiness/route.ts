import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ReadinessPayload = {
  STATUS: 'HEALTH_OK' | 'HEALTH_DEGRADED';
  TIMESTAMP: number;
  CHECKS: {
    ENV: 'UP' | 'DOWN';
    RUNTIME: 'UP';
  };
};

function unixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Edge readiness probe for upstream balancers.
 * GET /api/health/readiness
 */
export async function GET(): Promise<NextResponse<ReadinessPayload>> {
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const envOk =
    supabaseUrl.toLowerCase().startsWith('https://') && anonKey.length >= 32;

  const payload: ReadinessPayload = {
    STATUS: envOk ? 'HEALTH_OK' : 'HEALTH_DEGRADED',
    TIMESTAMP: unixTimestamp(),
    CHECKS: {
      ENV: envOk ? 'UP' : 'DOWN',
      RUNTIME: 'UP',
    },
  };

  return NextResponse.json(payload, {
    status: envOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
