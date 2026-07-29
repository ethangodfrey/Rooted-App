'use client';

import { useEffect } from 'react';

/**
 * Root-level App Router boundary. Replaces the root layout when a fatal
 * client/server render crash escapes every segment boundary (WSOD prevention).
 *
 * Must render its own <html> and <body> — the root layout is unmounted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('GLOBAL_ERROR_BOUNDARY_ADDED');
    // eslint-disable-next-line no-console
    console.log(
      `CLIENT_CRASH_CAUGHT SCOPE=GLOBAL DIGEST=${error.digest ?? 'NONE'} DETAIL=${error.message}`,
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          fontFamily: 'IBM Plex Sans, Segoe UI, system-ui, sans-serif',
          background: '#0B1228',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#f97316',
            }}
          >
            GLOBAL_ERROR_BOUNDARY_ADDED
          </p>
          <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Critical Application Error
          </h1>
          <p style={{ margin: 0, color: 'rgba(248,250,252,0.68)', lineHeight: 1.6 }}>
            The marketplace hit an unexpected failure. Your session was preserved — try again to
            reload this view.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.5rem',
              border: 0,
              borderRadius: 12,
              background: '#ea580c',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.04em',
              padding: '0.85rem 1.5rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
