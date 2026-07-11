/**
 * Canonical production deploy targets for Vendorly.
 * Web: Vercel project Vendorly_Marketplace1 only.
 */
export const VERCEL_PROJECT_NAME = 'Vendorly_Marketplace1';

/** Default production web URL (confirm in Vercel → Vendorly_Marketplace1 → Domains). */
export const VERCEL_PRODUCTION_WEB_URL = 'https://vendorly-marketplace1.vercel.app';

export const PRODUCTION_API_URL = 'https://api.vendorly.app';

export const POS_WEBHOOK_TEST_URL = `${VERCEL_PRODUCTION_WEB_URL}/api/webhooks/pos-sync?provider=SQUARE`;

export const CHECKOUT_TEST_URL = `${VERCEL_PRODUCTION_WEB_URL}/api/checkout/initiate`;
