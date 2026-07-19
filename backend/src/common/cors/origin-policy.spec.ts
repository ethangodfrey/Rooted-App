import {
  isCorsOriginAllowed,
  isTrustedVercelMarketplaceOrigin,
  isTrustedVendorlyOrigin,
} from './origin-policy';

describe('isTrustedVendorlyOrigin', () => {
  it('accepts https vendorlymarketplace.com and subdomains', () => {
    expect(isTrustedVendorlyOrigin('https://vendorlymarketplace.com')).toBe(true);
    expect(isTrustedVendorlyOrigin('https://shop.vendorlymarketplace.com')).toBe(
      true,
    );
    expect(isTrustedVendorlyOrigin('https://tenant-1.vendorlymarketplace.com')).toBe(
      true,
    );
  });

  it('accepts https vendorlymarketplace.app API/app hosts', () => {
    expect(isTrustedVendorlyOrigin('https://vendorlymarketplace.app')).toBe(true);
    expect(isTrustedVendorlyOrigin('https://api.vendorlymarketplace.app')).toBe(
      true,
    );
  });

  it('accepts legacy vendorly.app hosts during cutover', () => {
    expect(isTrustedVendorlyOrigin('https://vendorly.app')).toBe(true);
    expect(isTrustedVendorlyOrigin('https://shop.vendorly.app')).toBe(true);
  });

  it('rejects non-https and unrelated hosts', () => {
    expect(isTrustedVendorlyOrigin('http://vendorlymarketplace.com')).toBe(false);
    expect(
      isTrustedVendorlyOrigin('https://evil-vendorlymarketplace.com.attacker.com'),
    ).toBe(false);
    expect(isTrustedVendorlyOrigin('https://example.com')).toBe(false);
  });
});

describe('isTrustedVercelMarketplaceOrigin', () => {
  it('accepts known Vendorly marketplace Vercel hosts', () => {
    expect(isTrustedVercelMarketplaceOrigin('https://vendorly-marketplace1.vercel.app')).toBe(
      true,
    );
    expect(isTrustedVercelMarketplaceOrigin('https://vendorlymarketplace.vercel.app')).toBe(true);
  });

  it('accepts Vercel deployment / preview URLs for the marketplace project', () => {
    expect(
      isTrustedVercelMarketplaceOrigin(
        'https://vendorly-marketplace1-git-main-ethangodfreys-projects.vercel.app',
      ),
    ).toBe(true);
    expect(
      isTrustedVercelMarketplaceOrigin(
        'https://vendorly-marketplace1-65kqh8duhc-ethangodfreys-projects.vercel.app',
      ),
    ).toBe(true);
  });

  it('rejects unrelated Vercel apps', () => {
    expect(isTrustedVercelMarketplaceOrigin('https://random-app.vercel.app')).toBe(false);
  });
});

describe('isCorsOriginAllowed', () => {
  const allowed = new Set(['https://vendorlymarketplace.com']);

  it('allows explicit configured origins in production', () => {
    expect(
      isCorsOriginAllowed('https://vendorlymarketplace.com', {
        isDev: false,
        allowedOrigins: allowed,
      }),
    ).toBe(true);
  });

  it('allows marketplace subdomains in production without explicit listing', () => {
    expect(
      isCorsOriginAllowed('https://ops.vendorlymarketplace.com', {
        isDev: false,
        allowedOrigins: allowed,
      }),
    ).toBe(true);
  });

  it('allows marketplace Vercel hosts in production without explicit listing', () => {
    expect(
      isCorsOriginAllowed('https://vendorly-marketplace1.vercel.app', {
        isDev: false,
        allowedOrigins: allowed,
      }),
    ).toBe(true);
  });

  it('denies missing origin in production', () => {
    expect(isCorsOriginAllowed(undefined, { isDev: false, allowedOrigins: allowed })).toBe(false);
  });

  it('allows missing origin in development', () => {
    expect(isCorsOriginAllowed(undefined, { isDev: true, allowedOrigins: allowed })).toBe(true);
  });
});
