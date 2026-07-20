import { api } from '@/lib/api';

export type LoyaltyTier = {
  tier: string;
  pointsRequired: number;
  label: string;
  voucherCents: number | null;
};

export type LoyaltyBalance = {
  STATUS: string;
  POINTS_TOTAL: number;
  RSVP_POINTS?: number;
  CATERING_POINTS?: number;
  COLLABORATION_POINTS?: number;
  BOOSTED_POINTS?: number;
  TIERS: LoyaltyTier[];
  NEXT_TIER: string | null;
  NEXT_POINTS: number | null;
  PROGRESS_RATIO: number;
  NEXT_LABEL: string | null;
};

export type ActiveBoostItem = {
  id: string;
  vendorId: string;
  vendorName: string | null;
  label: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
};

export type VendorLoyaltyStatus = {
  STATUS: string;
  REWARDS_OPT_IN: boolean;
  BOOST_BALANCE_CENTS: number;
  BOOST_ACTIVE: boolean;
  ACTIVE_BOOSTS: Array<{
    id: string;
    label: string;
    multiplier: number;
    endsAt: string;
  }>;
};

export async function fetchLoyaltyBalance(): Promise<LoyaltyBalance> {
  return api.get('/api/loyalty/balance');
}

export async function fetchActiveBoosts(
  limit = 40,
): Promise<{ STATUS: string; ITEMS: ActiveBoostItem[]; COUNT: number }> {
  return api.get(`/api/loyalty/boosts?limit=${limit}`);
}

export async function fetchVendorLoyaltyStatus(): Promise<VendorLoyaltyStatus> {
  return api.get('/api/loyalty/vendor/status');
}

export async function setVendorRewardsOptIn(
  enabled: boolean,
): Promise<{ STATUS: string; REWARDS_OPT_IN: boolean }> {
  return api.put('/api/loyalty/vendor/opt-in', { enabled });
}

export async function toggleVendorBoost(
  enabled: boolean,
): Promise<{ STATUS: string; BOOST_ACTIVE: boolean }> {
  return api.put('/api/loyalty/vendor/boost/toggle', { enabled });
}

export async function fundVendorBoostBalance(
  cents: number,
): Promise<{ STATUS: string; FUNDED_CENTS: number }> {
  return api.post('/api/loyalty/vendor/fund', { cents });
}
