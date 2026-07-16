export const dynamic = 'force-dynamic';

/**
 * Shopper cart / pay-at-preorder entry — `/shopper/cart`.
 * Deep-links into the marketplace SPA cart when configured.
 *
 * Pay Now vs Pay at Pickup UI + reservation payload live in the SPA
 * (`web` CartDrawer → POST /checkout with `paymentMethod: 'pickup' | 'stripe'`).
 * Pickup bypasses Stripe Connect validation on the Nest checkout service.
 */
export default function ShopperCartPage() {
  const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim().replace(/\/$/, '') || null;
  const target = marketplaceUrl ? `${marketplaceUrl}/shopper/cart` : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#0B1228] px-4 py-16 font-sans text-zinc-50">
      <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 opacity-85">
        Checkout
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Your bag</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-white/70">
        Choose Pay Now (card) or Pay at Pickup when vendors allow it — including SNAP/EBT at the booth
        terminal.
      </p>
      {target ? (
        <a
          href={target}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-orange-500 active:scale-[0.98] no-underline"
        >
          Continue to payment choice
        </a>
      ) : (
        <p className="mt-6 rounded-xl border border-white/10 bg-[#121A36] px-4 py-3 text-sm text-white/70">
          Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_MARKETPLACE_URL</code> to open
          the Vendorly marketplace cart.
        </p>
      )}
    </main>
  );
}
