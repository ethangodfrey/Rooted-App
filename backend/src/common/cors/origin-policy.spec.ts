import {
  isCorsOriginAllowed,
  isTrustedVercelMarketplaceOrigin,
  isTrustedVendorlyOrigin,
} from './origin-policy';

describe('isTrustedVendorlyOrigin', () => {
  it('accepts https vendorly.app and subdomains', () => {
    expect(isTrustedVendorlyOrigin('https://vendorly.app')).toBe(true);
    expect(isTrustedVendorlyOrigin('https://shop.vendorly.app')).toBe(true);
    expect(isTrustedVendorlyOrigin('https://tenant-1.vendorly.app')).toBe(true);
  });

  it('rejects non-https and unrelated hosts', () => {
    expect(isTrustedVendorlyOrigin('http://vendorly.app')).toBe(false);
    expect(isTrustedVendorlyOrigin('https://evil-vendorly.app.attacker.com')).toBe(false);
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
  const allowed = new Set(['https://vendorly.app']);

  it('allows explicit configured origins in production', () => {
    expect(
      isCorsOriginAllowed('https://vendorly.app', { isDev: false, allowedOrigins: allowed }),
    ).toBe(true);
  });

  it('allows vendorly subdomains in production without explicit listing', () => {
    expect(
      isCorsOriginAllowed('https://ops.vendorly.app', { isDev: false, allowedOrigins: allowed }),
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
