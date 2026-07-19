/**
 * Text-only tenant fallback surface (no emoji).
 * Used by layout guards and MarketTheme error boundaries.
 */

export function TenantNotFoundFallback({
  host,
  slug,
  detail,
}: {
  host?: string | null;
  slug?: string | null;
  detail?: string | null;
}) {
  return (
    <main
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        padding: '2.5rem 1.5rem',
        maxWidth: 640,
        margin: '0 auto',
        color: '#111827',
        background:
          'linear-gradient(180deg, #f8fafc 0%, #eef2ff 55%, #f8fafc 100%)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <p
        style={{
          margin: 0,
          letterSpacing: '0.14em',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#6b7280',
        }}
      >
        FALLBACK_TRIGGERED
      </p>
      <h1
        style={{
          margin: '0.75rem 0 0',
          fontSize: '1.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        TENANT_NOT_FOUND
      </h1>
      <p style={{ marginTop: '1rem', lineHeight: 1.6, color: '#374151' }}>
        The requested marketplace subdomain is invalid, unseeded, or could not be
        resolved. Directory theme injection was skipped.
      </p>
      {slug ? (
        <p style={{ marginTop: '1rem' }}>
          SLUG <code>{slug}</code>
        </p>
      ) : null}
      {host ? (
        <p style={{ marginTop: '0.35rem' }}>
          HOST <code>{host}</code>
        </p>
      ) : null}
      {detail ? (
        <p style={{ marginTop: '0.35rem', color: '#6b7280' }}>
          DETAIL <code>{detail}</code>
        </p>
      ) : null}
      <p style={{ marginTop: '1.75rem' }}>
        <a href="/" style={{ color: '#1f6b4f', textDecoration: 'underline' }}>
          RETURN_PLATFORM_HOME
        </a>
      </p>
    </main>
  );
}
