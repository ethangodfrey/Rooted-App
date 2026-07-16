import { POSDashboard } from '@/components/POSDashboard';

export const dynamic = 'force-dynamic';

/**
 * POS analytics dashboard page.
 * Pass vendorId (+ optional access_token) via query string for demos;
 * production embeds should pass the token from the authenticated shell.
 */
export default async function VendorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vendorId = typeof params.vendorId === 'string' ? params.vendorId : '';
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
          Provide <code className="rounded bg-stone-200/70 px-1">?vendorId=…</code> (and a Bearer
          token via the dashboard props / Authorization header) to load POS analytics.
        </p>
      </main>
    );
  }

  return (
    <main>
      <POSDashboard vendorId={vendorId} accessToken={accessToken} />
    </main>
  );
}
