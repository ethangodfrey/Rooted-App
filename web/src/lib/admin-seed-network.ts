import { api, isApiConfigured } from '@/lib/api';

export type LocalNetworkSeedResult = {
  profiles: number;
  shoppers: number;
  vendors: number;
  farmers: number;
  listings: number;
  connections: number;
  follows: number;
  posLinks: number;
  summary: string;
};

/** Admin-only: run the Denver local network stress seed via Nest. */
export async function runLocalNetworkSeed(): Promise<LocalNetworkSeedResult> {
  if (!isApiConfigured) {
    throw new Error('Backend API is not configured for network seeding.');
  }
  return api.post<LocalNetworkSeedResult>('/admin/seed-network');
}
