/**
 * Domain role helpers.
 * Canonical platform buyer role: `shopper`.
 * Legacy DB value `customer` is still accepted at read boundaries.
 */

/** True when the account is a shopper (includes legacy `customer`). */
export function isShopperRole(role: string | null | undefined): boolean {
  return role === 'shopper' || role === 'customer';
}

/**
 * @deprecated Prefer `isShopperRole`. Kept for call-site compatibility during migration.
 */
export function isCustomerRole(role: string | null | undefined): boolean {
  return isShopperRole(role);
}
