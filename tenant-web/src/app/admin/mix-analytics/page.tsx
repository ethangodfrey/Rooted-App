import { MixAnalyticsDashboard } from '@/components/MixAnalyticsDashboard';

export const dynamic = 'force-dynamic';

/**
 * Vendor Matchmaking & Mix Analytics — `/admin/mix-analytics`.
 *
 * Pass Bearer auth via `access_token` query (demos) or embed
 * MixAnalyticsDashboard with accessToken from an authenticated shell.
 */
export default async function AdminMixAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const accessToken =
    typeof params.access_token === 'string'
      ? params.access_token
      : typeof params.accessToken === 'string'
        ? params.accessToken
        : null;

  return (
    <main className="bg-[#0B1228]">
      <MixAnalyticsDashboard accessToken={accessToken} />
    </main>
  );
}
