import { POSDashboard } from '@/components/POSDashboard';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POS analytics dashboard — `/vendor/analytics?vendorId=<uuid>`.
 *
 * Pass the Supabase access token via the `access_token` query param for demos,
 * or embed POSDashboard with `accessToken` from your authenticated shell
 * (preferred in production — avoid putting JWTs in URLs).
 */
export default async function VendorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vendorId = typeof params.vendorId === 'string' ? params.vendorId.trim() : '';
  const accessToken =
    typeof params.access_token === 'string'
      ? params.access_token
      : typeof params.accessToken === 'string'
        ? params.accessToken
        : null;

  if (!vendorId) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 font-sans">
        <h1 className="font-display text-2xl font-semibold text-ink-950">Sales analytics</h1>
        <p className="mt-2 text-sm text-ink-600">
          Provide <code className="rounded bg-stone-200/70 px-1">?vendorId=…</code> and authorize
          with a Bearer token to load POS analytics.
        </p>
      </main>
    );
  }

  if (!UUID_RE.test(vendorId)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 font-sans">
        <h1 className="font-display text-2xl font-semibold text-ink-950">Sales analytics</h1>
        <p className="mt-2 text-sm text-rose-700">vendorId must be a valid UUID.</p>
      </main>
    );
  }

  return (
    <main>
      <POSDashboard vendorId={vendorId} accessToken={accessToken} />
    </main>
  );
}
