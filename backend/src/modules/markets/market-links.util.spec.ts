import {
  extractMarketLinks,
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizeMarketWebsiteUrl,
} from './market-links.util';

describe('market-links.util', () => {
  it('normalizes bare facebook handles', () => {
    expect(normalizeFacebookUrl('GreenMeadowsFarm')).toBe('https://www.facebook.com/GreenMeadowsFarm');
    expect(normalizeFacebookUrl('www.facebook.com/hocfarms')).toBe('https://www.facebook.com/hocfarms');
  });

  it('normalizes instagram handles', () => {
    expect(normalizeInstagramUrl('@citymarket')).toBe('https://www.instagram.com/citymarket');
  });

  it('rejects usda portal as website', () => {
    expect(normalizeMarketWebsiteUrl('https://www.usdalocalfoodportal.com/fe/farmersmarket')).toBeNull();
  });

  it('extracts social links from extra_info and relocates social websites', () => {
    const links = extractMarketLinks({
      websiteUrl: 'https://www.facebook.com/examplemarket',
      extraInfo: 'Facebook: www.facebook.com/examplemarket\nInstagram: citymarket',
      syncMetadata: {},
    });

    expect(links.facebook).toBe('https://www.facebook.com/examplemarket');
    expect(links.instagram).toBe('https://www.instagram.com/citymarket');
    expect(links.website).toBeNull();
  });
});
