import { describe, expect, it } from 'vitest';

import { marketPath, vendorPath } from './market-routes';

describe('marketPath', () => {
  it('builds the canonical shopper market detail route', () => {
    expect(marketPath('event-123')).toBe('/markets/event-123');
  });

  it('preserves opaque UUID-style identifiers', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    expect(marketPath(id)).toBe(`/markets/${id}`);
  });
});

describe('vendorPath', () => {
  it('builds the vendor storefront route without a market context', () => {
    expect(vendorPath('vendor-1')).toBe('/vendors/vendor-1');
  });

  it('appends an encoded market query parameter when provided', () => {
    expect(vendorPath('vendor-1', 'market-2')).toBe('/vendors/vendor-1?market=market-2');
  });

  it('URL-encodes market ids with reserved characters', () => {
    expect(vendorPath('vendor-1', 'market id/with?chars')).toBe(
      '/vendors/vendor-1?market=market%20id%2Fwith%3Fchars',
    );
  });

  it('ignores empty market ids', () => {
    expect(vendorPath('vendor-1', '')).toBe('/vendors/vendor-1');
  });
});
