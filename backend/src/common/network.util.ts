import { networkInterfaces } from 'node:os';

/** Non-loopback IPv4 addresses for LAN access hints. */
export function getLanIpv4Addresses(): string[] {
  const nets = networkInterfaces();
  const addresses: string[] = [];

  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      const family = net.family as string | number;
      const isIpv4 = family === 'IPv4' || family === 4;
      if (isIpv4 && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  return [...new Set(addresses)];
}

const PRIVATE_LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function isDevLanOrigin(origin: string): boolean {
  return PRIVATE_LAN_ORIGIN.test(origin);
}
