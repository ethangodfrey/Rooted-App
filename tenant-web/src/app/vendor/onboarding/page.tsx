import { VENDOR_PERSONA_OPTIONS } from '@/lib/vendor-types';

export const dynamic = 'force-dynamic';

/**
 * Vendor persona onboarding — `/vendor/onboarding`.
 * Deep-links into the marketplace SPA when configured.
 */
export default function VendorOnboardingPage() {
  const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim().replace(/\/$/, '') || null;
  const target = marketplaceUrl ? `${marketplaceUrl}/vendor/onboarding` : null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
      <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
        Onboarding
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">How do you sell?</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
        Choose Market Vendor, Home Chef, or Private Chef — saved to{' '}
        <code className="rounded bg-white/10 px-1">vendor_type</code>.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {VENDOR_PERSONA_OPTIONS.map((option) => (
          <div
            key={option.value}
            className="rounded-2xl border border-white/10 bg-[#121A36] px-4 py-5"
          >
            <p className="m-0 text-3xl" aria-hidden>
              {option.emoji}
            </p>
            <p className="mt-3 m-0 text-lg font-extrabold">{option.title}</p>
            <p className="mt-2 m-0 text-sm text-white/60">{option.description}</p>
          </div>
        ))}
      </div>

      {target ? (
        <a
          href={target}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-orange-500 active:scale-[0.98] no-underline"
        >
          Continue in marketplace
        </a>
      ) : (
        <p className="mt-6 rounded-xl border border-white/10 bg-[#121A36] px-4 py-3 text-sm text-white/70">
          Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_MARKETPLACE_URL</code> to open
          the Vendorly marketplace onboarding flow.
        </p>
      )}
    </main>
  );
}
