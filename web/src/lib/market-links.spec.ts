import { describe, expect, it } from 'vitest';

import {
  extraInfoWithoutSocialLinks,
  extractMarketLinks,
  linkDisplayLabel,
} from './market-links';

describe('extractMarketLinks', () => {
  it('returns null links for empty event payloads', () => {
    expect(extractMarketLinks({})).toEqual({
      website: null,
      facebook: null,
      instagram: null,
    });
    expect(
      extractMarketLinks({
        website_url: '',
        extra_info: undefined,
        sync_metadata: null,
      }),
    ).toEqual({
      website: null,
      facebook: null,
      instagram: null,
    });
  });

  it('normalizes website URLs and strips trailing slashes', () => {
    expect(
      extractMarketLinks({
        website_url: 'example.com',
      }).website,
    ).toBe('https://example.com');
    expect(
      extractMarketLinks({
        website_url: 'https://www.riverfarm.com/',
      }).website,
    ).toBe('https://www.riverfarm.com');
  });

  it('rejects USDA portal and social hosts as website links', () => {
    expect(
      extractMarketLinks({
        website_url: 'https://www.usdalocalfoodportal.com/dir/',
      }).website,
    ).toBeNull();
    expect(
      extractMarketLinks({
        website_url: 'https://www.facebook.com/riverfarm',
      }),
    ).toEqual({
      website: null,
      facebook: null,
      instagram: null,
    });
  });

  it('parses Facebook and Instagram from metadata and extra_info', () => {
    expect(
      extractMarketLinks({
        sync_metadata: {
          facebook_url: '@riverfarm',
          instagram_url: 'riverfarm',
        },
        extra_info: 'Facebook: fb.com/riverfarm\nInstagram: @riverfarm_il',
      }),
    ).toEqual({
      website: null,
      facebook: 'https://www.facebook.com/riverfarm',
      instagram: 'https://www.instagram.com/riverfarm',
    });
  });

  it('prefers explicit metadata over extra_info lines', () => {
    expect(
      extractMarketLinks({
        sync_metadata: { instagram_url: 'https://www.instagram.com/official' },
        extra_info: 'Instagram: @other',
      }).instagram,
    ).toBe('https://www.instagram.com/official');
  });

  it('rejects invalid social handles and bare homepages', () => {
    expect(
      extractMarketLinks({
        sync_metadata: {
          facebook_url: 'https://www.facebook.com/',
          instagram_url: 'not a handle!',
        },
      }),
    ).toEqual({
      website: null,
      facebook: null,
      instagram: null,
    });
  });
});

describe('extraInfoWithoutSocialLinks', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(extraInfoWithoutSocialLinks(null)).toBeNull();
    expect(extraInfoWithoutSocialLinks('')).toBeNull();
    expect(extraInfoWithoutSocialLinks('   ')).toBeNull();
  });

  it('strips Facebook and Instagram lines while preserving other copy', () => {
    expect(
      extraInfoWithoutSocialLinks('Parking in rear\nFacebook: fb.com/x\nDogs welcome'),
    ).toBe('Parking in rear\nDogs welcome');
  });

  it('returns null when only social lines remain', () => {
    expect(extraInfoWithoutSocialLinks('Facebook: fb.com/x\nInstagram: @x')).toBeNull();
  });
});

describe('linkDisplayLabel', () => {
  it('labels known social hosts', () => {
    expect(linkDisplayLabel('https://www.facebook.com/riverfarm')).toBe('Facebook');
    expect(linkDisplayLabel('https://instagram.com/riverfarm')).toBe('Instagram');
  });

  it('returns hostname without www for regular websites', () => {
    expect(linkDisplayLabel('https://www.riverfarm.com/about')).toBe('riverfarm.com');
  });

  it('falls back to the raw string when URL parsing fails', () => {
    expect(linkDisplayLabel('not-a-valid-url')).toBe('not-a-valid-url');
    expect(linkDisplayLabel('')).toBe('');
  });
});
