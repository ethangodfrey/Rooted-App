import Link from 'next/link';

const MESSAGES: Record<string, string> = {
  not_found: 'We could not find a marketplace for this domain.',
  suspended: 'This marketplace is temporarily unavailable.',
  missing_host: 'The request did not include a valid hostname.',
  resolve_failed: 'Tenant routing failed due to a temporary error. Please retry shortly.',
};

export default async function TenantErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; host?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? 'resolve_failed';
  const host = params.host ?? '';
  const message = MESSAGES[reason] ?? MESSAGES.resolve_failed;

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Marketplace unavailable</h1>
      <p>{message}</p>
      {host ? (
        <p>
          Host: <code>{host}</code>
        </p>
      ) : null}
      <p>
        <Link href="/">Return to platform home</Link>
      </p>
    </main>
  );
}
