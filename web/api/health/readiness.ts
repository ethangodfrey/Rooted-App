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

export const config = {
  runtime: 'edge',
};

/**
 * Vite SPA edge readiness probe (Vercel).
 * GET /api/health/readiness
 */
export default function handler(_request: Request): Response {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
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

  return new Response(JSON.stringify(payload), {
    status: envOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
