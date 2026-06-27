/** DB may store `customer` (Vendorly) or legacy `shopper`. */
export function isCustomerRole(role: string | null | undefined): boolean {
  return role === 'customer' || role === 'shopper';
}
