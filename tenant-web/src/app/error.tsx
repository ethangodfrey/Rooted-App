'use client';

import { useEffect } from 'react';

function isVerboseErrorSurface(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const vercelEnv = (process.env.NEXT_PUBLIC_VERCEL_ENV || '').toLowerCase();
  return vercelEnv === 'preview' || vercelEnv === 'development';
}

/**
 * Root segment error boundary — catches client render crashes under the root
 * layout without unmounting the entire document (unlike global-error).
 */
export default function RootSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const showDetail = isVerboseErrorSurface();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      `CLIENT_CRASH_CAUGHT SCOPE=SEGMENT DIGEST=${error.digest ?? 'NONE'} DETAIL=${error.message}`,
    );
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-[#0B1228] px-6 py-16 font-sans text-zinc-50">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">
        CLIENT_CRASH_CAUGHT
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-50">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300/80">
        Vendorly could not finish rendering this page. You can retry without leaving the app.
      </p>
      {showDetail ? (
        <pre className="mt-6 overflow-x-auto rounded-xl border border-orange-500/30 bg-[#121a36] p-4 font-mono text-xs leading-relaxed text-orange-100/90 whitespace-pre-wrap break-words">
          {error.message || 'UNKNOWN_CLIENT_ERROR'}
          {error.digest ? `\nDIGEST=${error.digest}` : ''}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-orange-500 active:scale-[0.98]"
      >
        Try Again
      </button>
    </main>
  );
}
