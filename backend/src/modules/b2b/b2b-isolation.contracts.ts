/**
 * Explicit B2B multi-tenant isolation contracts.
 * Uppercase text-only diagnostics — no emoji.
 */

export const TENANT_A_VENDOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const TENANT_B_VENDOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const TENANT_C_VENDOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export const WHOLESALE_SKU_TENANT_A_ID = '11111111-1111-4111-8111-111111111111';
export const CONNECTION_TENANT_A_ID = '22222222-2222-4222-8222-222222222222';

/** Expected RLS / service predicates for vendor_business_connections. */
export const CONNECTION_ISOLATION_CONTRACT = {
  TABLE: 'vendor_business_connections',
  SELECT_SCOPE: 'SENDER_OR_RECEIVER_MUST_MATCH_AUTH_VENDOR',
  INSERT_SCOPE: 'SENDER_MUST_MATCH_AUTH_VENDOR',
  UPDATE_SCOPE: 'SENDER_OR_RECEIVER_MUST_MATCH_AUTH_VENDOR',
  CROSS_TENANT_RESPONSE: 'EMPTY_OR_FORBIDDEN',
} as const;

/** Expected RLS / service predicates for wholesale_products. */
export const WHOLESALE_ISOLATION_CONTRACT = {
  TABLE: 'wholesale_products',
  MUTATION_SCOPE: 'VENDOR_ID_MUST_MATCH_AUTH_VENDOR',
  OWN_LIST_SCOPE: 'VENDOR_ID_EQUALS_SESSION_VENDOR',
  CROSS_TENANT_MUTATION: 'FORBIDDEN',
  CROSS_TENANT_OWN_LIST: 'EMPTY_PAYLOAD',
} as const;

export function logIsolation(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

export function assertNoCrossTenantLeak(
  rows: ReadonlyArray<{ vendorId?: string; senderVendorId?: string; receiverVendorId?: string }>,
  sessionVendorId: string,
  mode: 'WHOLESALE' | 'CONNECTION',
): void {
  for (const row of rows) {
    if (mode === 'WHOLESALE') {
      if (row.vendorId && row.vendorId !== sessionVendorId) {
        throw new Error(
          `CROSS_TENANT_LEAK_DETECTED MODE=WHOLESALE SESSION=${sessionVendorId} ROW_VENDOR=${row.vendorId}`,
        );
      }
      continue;
    }
    const participant =
      row.senderVendorId === sessionVendorId || row.receiverVendorId === sessionVendorId;
    if (!participant) {
      throw new Error(
        `CROSS_TENANT_LEAK_DETECTED MODE=CONNECTION SESSION=${sessionVendorId} SENDER=${row.senderVendorId} RECEIVER=${row.receiverVendorId}`,
      );
    }
  }
}
