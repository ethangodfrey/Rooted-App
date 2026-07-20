/**
 * Meet the Makers ranking — location + preferred categories.
 * Telemetry: DISCOVERY_INTERFACE_INITIALIZED, PARTNERSHIP_FEED_SYNCED
 */

import { clampAlertRadiusKm, isWithinAlertRadiusKm } from './alert-radius.util';

export type MakerFeedCandidate = {
  postId: string;
  vendorId: string;
  eventId: string | null;
  caption: string;
  mediaUrl: string | null;
  cdnMediaUrl: string | null;
  mediaType: string;
  contentType: string;
  postingMode: string;
  coApprovalStatus: string;
  contributorId: string | null;
  contributorType: string | null;
  partnerContributorId: string | null;
  partnerContributorType: string | null;
  contributionMetadata: unknown;
  publishAt: Date | string;
  vendorName: string | null;
  vendorLatitude: number | null;
  vendorLongitude: number | null;
  vendorSpecialties: string[];
  partnerName: string | null;
  partnerSpecialties: string[];
  eventName: string | null;
  eventLatitude: number | null;
  eventLongitude: number | null;
};

export type RankedMakerFeedItem = MakerFeedCandidate & {
  distanceKm: number | null;
  categoryScore: number;
  rankScore: number;
  withinRadius: boolean;
  preferredCategoryHits: string[];
};

export function normalizeCategoryToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

export function overlapCategories(
  preferred: string[],
  available: string[],
): string[] {
  const pref = new Set(preferred.map(normalizeCategoryToken).filter(Boolean));
  const hits: string[] = [];
  for (const item of available) {
    const token = normalizeCategoryToken(item);
    if (token && pref.has(token)) hits.push(token);
  }
  return [...new Set(hits)];
}

export function scoreMakerCandidate(input: {
  candidate: MakerFeedCandidate;
  shopperLat?: number | null;
  shopperLng?: number | null;
  alertRadiusKm: number;
  preferredCategories: string[];
}): RankedMakerFeedItem {
  const radius = clampAlertRadiusKm(input.alertRadiusKm);
  const specialties = [
    ...input.candidate.vendorSpecialties,
    ...input.candidate.partnerSpecialties,
  ];
  const preferredCategoryHits = overlapCategories(
    input.preferredCategories,
    specialties,
  );
  const categoryScore = preferredCategoryHits.length;

  let distanceKm: number | null = null;
  let withinRadius = true;

  const pointLat =
    input.candidate.eventLatitude ?? input.candidate.vendorLatitude;
  const pointLng =
    input.candidate.eventLongitude ?? input.candidate.vendorLongitude;

  if (
    input.shopperLat != null &&
    input.shopperLng != null &&
    pointLat != null &&
    pointLng != null &&
    Number.isFinite(pointLat) &&
    Number.isFinite(pointLng)
  ) {
    const check = isWithinAlertRadiusKm(
      { latitude: input.shopperLat, longitude: input.shopperLng },
      { latitude: pointLat, longitude: pointLng },
      radius,
    );
    distanceKm = Number(check.distanceKm.toFixed(3));
    withinRadius = check.within;
  }

  // Higher is better: category hits dominate; nearer distance boosts score.
  const proximityBoost =
    distanceKm == null ? 0 : Math.max(0, radius - distanceKm) / radius;
  const rankScore =
    categoryScore * 10 + proximityBoost * 5 + (withinRadius ? 1 : 0);

  return {
    ...input.candidate,
    distanceKm,
    categoryScore,
    rankScore,
    withinRadius,
    preferredCategoryHits,
  };
}

export function rankMakerFeed(
  candidates: MakerFeedCandidate[],
  options: {
    shopperLat?: number | null;
    shopperLng?: number | null;
    alertRadiusKm: number;
    preferredCategories: string[];
    requireWithinRadius?: boolean;
  },
): RankedMakerFeedItem[] {
  const ranked = candidates.map((candidate) =>
    scoreMakerCandidate({
      candidate,
      shopperLat: options.shopperLat,
      shopperLng: options.shopperLng,
      alertRadiusKm: options.alertRadiusKm,
      preferredCategories: options.preferredCategories,
    }),
  );

  const filtered = options.requireWithinRadius
    ? ranked.filter((item) => item.withinRadius)
    : ranked;

  return filtered.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (
      new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime()
    );
  });
}

export function formatDiscoveryInterfaceInitializedLog(): string {
  return 'DISCOVERY_INTERFACE_INITIALIZED SURFACE=MEET_THE_MAKERS';
}

export function formatPartnershipFeedSyncedLog(input: {
  count: number;
  alertRadiusKm: number;
}): string {
  return `PARTNERSHIP_FEED_SYNCED COUNT=${input.count} ALERT_RADIUS_KM=${input.alertRadiusKm}`;
}
