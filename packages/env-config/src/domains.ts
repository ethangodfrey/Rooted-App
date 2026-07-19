/**
 * Canonical Vendorly Marketplace public hosts.
 * Client apex: vendorlymarketplace.com
 * API apex:    api.vendorlymarketplace.app
 */

export const CANONICAL_APP_HOST = 'vendorlymarketplace.com';
export const CANONICAL_APP_ORIGIN = 'https://vendorlymarketplace.com';
export const CANONICAL_WWW_ORIGIN = 'https://www.vendorlymarketplace.com';

export const CANONICAL_API_HOST = 'api.vendorlymarketplace.app';
export const CANONICAL_API_ORIGIN = 'https://api.vendorlymarketplace.app';

/** Legacy hosts retained for CORS trust during DNS cutover. */
export const LEGACY_APP_HOST = 'vendorly.app';
export const LEGACY_API_HOST = 'api.vendorly.app';

/** Longest production host we expect parsers to accept without truncation. */
export const MAX_PUBLIC_URL_LENGTH = 2048;
