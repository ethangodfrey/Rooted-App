import { getLanIpv4Addresses, isDevLanOrigin } from './network.util';

describe('isDevLanOrigin', () => {
  it('accepts localhost and private LAN origins', () => {
    expect(isDevLanOrigin('http://localhost:5173')).toBe(true);
    expect(isDevLanOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isDevLanOrigin('http://192.168.1.42:8080')).toBe(true);
    expect(isDevLanOrigin('http://10.0.0.5')).toBe(true);
    expect(isDevLanOrigin('https://172.16.0.1:443')).toBe(true);
  });

  it('rejects public and malformed origins', () => {
    expect(isDevLanOrigin('https://vendorly.app')).toBe(false);
    expect(isDevLanOrigin('https://example.com')).toBe(false);
    expect(isDevLanOrigin('')).toBe(false);
    expect(isDevLanOrigin('not-a-url')).toBe(false);
    expect(isDevLanOrigin('ftp://localhost')).toBe(false);
  });
});

describe('getLanIpv4Addresses', () => {
  it('returns an array of unique IPv4 strings', () => {
    const addresses = getLanIpv4Addresses();
    expect(Array.isArray(addresses)).toBe(true);
    for (const addr of addresses) {
      expect(addr).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
    }
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});
