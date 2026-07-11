/** Canonical shopper paths for market (event) and vendor storefront detail. */
export function marketPath(id: string): string {
  return `/markets/${id}`;
}

export function vendorPath(id: string): string {
  return `/vendors/${id}`;
}
