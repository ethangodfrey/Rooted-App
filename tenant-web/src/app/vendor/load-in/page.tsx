import { LoadInDashboard } from '@/components/LoadInDashboard';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Morning Load-In focus mode — `/vendor/load-in?vendorId=<uuid>`.
 *
 * Hyper-focused indigo canvas (no tenant chrome). Pass Bearer auth via
 * `access_token` query (demos) or embed LoadInDashboard with accessToken.
 */
export default async function VendorLoadInPage({
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
      <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
          Morning load-in
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Focus mode</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
          Provide <code className="rounded bg-white/10 px-1">?vendorId=…</code> and authorize with a
          Bearer token to open the on-site load-in dashboard.
        </p>
      </main>
    );
  }

  if (!UUID_RE.test(vendorId)) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
        <h1 className="text-3xl font-extrabold tracking-tight">Focus mode</h1>
        <p className="mt-3 text-sm font-medium text-rose-300">vendorId must be a valid UUID.</p>
      </main>
    );
  }

  return (
    <main>
      <LoadInDashboard vendorId={vendorId} accessToken={accessToken} />
    </main>
  );
}
