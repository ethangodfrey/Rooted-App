export const dynamic = 'force-dynamic';

/**
 * Vendor fulfillment / service settings — `/vendor/settings/fulfillment`.
 * Deep-links into the marketplace SPA when configured.
 */
export default function VendorFulfillmentSettingsPage() {
  const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim().replace(/\/$/, '') || null;
  const target = marketplaceUrl ? `${marketplaceUrl}/vendor/settings/fulfillment` : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
      <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
        Fulfillment
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Service settings</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
        Home Chefs configure pickup, delivery radius, and cottage-food disclosures. Private Chefs set
        travel radius, base rate, and minimum guests.
      </p>
      {target ? (
        <a
          href={target}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-orange-500 active:scale-[0.98] no-underline"
        >
          Open fulfillment settings
        </a>
      ) : (
        <p className="mt-6 rounded-xl border border-white/10 bg-[#121A36] px-4 py-3 text-sm text-white/70">
          Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_MARKETPLACE_URL</code> to open
          the Vendorly marketplace fulfillment settings.
        </p>
      )}
    </main>
  );
}
