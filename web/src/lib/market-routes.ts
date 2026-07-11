/** Canonical shopper paths for market (event) and vendor storefront detail. */
export function marketPath(id: string): string {
  return `/markets/${id}`;
}

export function vendorPath(id: string, marketId?: string): string {
  const base = `/vendors/${id}`;
  if (!marketId) return base;
  return `${base}?market=${encodeURIComponent(marketId)}`;
}
