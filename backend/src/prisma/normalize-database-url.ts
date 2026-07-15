/**
 * Normalize Supabase / Railway Postgres URLs for Prisma.
 * - Transaction pooler (port 6543 / *.pooler.supabase.com) gets pgbouncer=true
 * - Ensures connect_timeout so health checks don't hang forever
 * - Strips sslmode=require (can fail on Node pg "verify-full" alias against pooler)
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return raw;

  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const port = url.port || '5432';
    const isPooler =
      port === '6543' ||
      host.includes('pooler.supabase.com') ||
      url.searchParams.get('pgbouncer') === 'true';

    if (isPooler) {
      url.searchParams.set('pgbouncer', 'true');
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '5');
      }
    }

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '15');
    }

    // Prefer default TLS negotiation over explicit require/verify-full mismatches.
    if (url.searchParams.get('sslmode') === 'require') {
      url.searchParams.delete('sslmode');
    }

    return url.toString();
  } catch {
    return raw;
  }
}

/** Host:port/db for readiness diagnostics — never includes credentials. */
export function describeDatabaseTarget(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const port = url.port || '5432';
    return `${url.hostname}:${port}${url.pathname}`;
  } catch {
    return 'invalid_DATABASE_URL';
  }
}
