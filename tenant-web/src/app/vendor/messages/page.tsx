'use client';

import { useEffect } from 'react';

/**
 * Tenant edge entry for vendor messaging.
 * Full split-pane inbox lives on the marketplace SPA (`/vendor/messages`).
 */
export default function VendorMessagesPage() {
  const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.replace(/\/$/, '') ?? '';

  useEffect(() => {
    if (marketplace) {
      window.location.replace(`${marketplace}/vendor/messages`);
    }
  }, [marketplace]);

  if (marketplace) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 bg-[#0B1228] px-6 text-center text-zinc-50">
        <p className="m-0 text-sm text-white/65">Opening vendor messages…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 bg-[#0B1228] px-6 text-center text-zinc-50">
      <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-orange-400 uppercase">
        Messages
      </p>
      <h1 className="m-0 text-3xl font-extrabold tracking-tight">Open the marketplace app</h1>
      <p className="m-0 max-w-sm text-sm text-white/65">
        Set <code className="text-orange-400">NEXT_PUBLIC_MARKETPLACE_URL</code> so tenant hosts can
        deep-link vendors into the Vendorly support inbox.
      </p>
    </main>
  );
}
