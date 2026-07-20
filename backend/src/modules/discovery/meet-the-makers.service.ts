import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  clampAlertRadiusKm,
  DEFAULT_ALERT_RADIUS_KM,
} from './alert-radius.util';
import {
  enrichUsdaListingHours,
  fetchUsdaFarmersMarketsByState,
  formatUsdaMarketDataSyncedLog,
  isUsMarketContext,
  normalizeUsStateAbbr,
  parseUsdaExternalId,
  type UsdaListingSnapshot,
} from './meet-the-makers-usda.util';
import {
  formatDiscoveryInterfaceInitializedLog,
  formatPartnershipFeedSyncedLog,
  rankMakerFeed,
  type MakerFeedCandidate,
  type RankedMakerFeedItem,
} from './meet-the-makers.ranking.util';

export type MeetTheMakersFeedResult = {
  STATUS: 'PARTNERSHIP_FEED_SYNCED';
  REGION: 'US';
  ITEMS: RankedMakerFeedItem[];
  ALERT_RADIUS_KM: number;
  COUNT: number;
  USDA_ENRICHED: number;
};

@Injectable()
export class MeetTheMakersService implements OnModuleInit {
  private readonly logger = new Logger(MeetTheMakersService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatDiscoveryInterfaceInitializedLog());
  }

  async getFeed(input: {
    userId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    alertRadiusKm?: number | null;
    preferredCategories?: string[];
    limit?: number;
  }): Promise<MeetTheMakersFeedResult> {
    const prefs = await this.resolveShopperPreferences(input.userId);
    const alertRadiusKm = clampAlertRadiusKm(
      input.alertRadiusKm ?? prefs.alertRadiusKm ?? DEFAULT_ALERT_RADIUS_KM,
    );
    const preferredCategories =
      input.preferredCategories && input.preferredCategories.length > 0
        ? input.preferredCategories
        : prefs.preferredCategories;

    const shopperLat = input.latitude ?? prefs.latitude;
    const shopperLng = input.longitude ?? prefs.longitude;

    const candidates = await this.loadPartnershipCandidates(
      Math.min(100, Math.max(1, input.limit ?? 40)),
    );

    const { candidates: enriched, usdaEnriched, directoryHits } =
      await this.enrichWithUsda(candidates, {
        shopperLat,
        shopperLng,
      });

    this.logger.log(
      formatUsdaMarketDataSyncedLog({
        enriched: usdaEnriched,
        directoryHits,
      }),
    );

    const ranked = rankMakerFeed(enriched, {
      shopperLat,
      shopperLng,
      alertRadiusKm,
      preferredCategories,
      requireWithinRadius: shopperLat != null && shopperLng != null,
    });

    this.logger.log(
      formatPartnershipFeedSyncedLog({
        count: ranked.length,
        alertRadiusKm,
        region: 'US',
      }),
    );

    return {
      STATUS: 'PARTNERSHIP_FEED_SYNCED',
      REGION: 'US',
      ITEMS: ranked,
      ALERT_RADIUS_KM: alertRadiusKm,
      COUNT: ranked.length,
      USDA_ENRICHED: usdaEnriched,
    };
  }

  async listJointContentForProfile(profileId: string): Promise<
    Array<{
      postId: string;
      caption: string;
      mediaUrl: string | null;
      cdnMediaUrl: string | null;
      publishAt: Date;
      contributorType: string | null;
      partnerContributorType: string | null;
      isUsMarket: boolean;
      eventName: string | null;
      operatingHours: string | null;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        caption: string;
        media_url: string | null;
        cdn_media_url: string | null;
        publish_at: Date;
        contributor_type: string | null;
        partner_contributor_type: string | null;
        vendor_country: string | null;
        event_state: string | null;
        event_name: string | null;
        hours_summary: string | null;
        external_source: string | null;
      }>
    >(Prisma.sql`
      SELECT
        p.id,
        p.caption,
        p.media_url,
        p.cdn_media_url,
        p.publish_at,
        p.contributor_type::text AS contributor_type,
        p.partner_contributor_type::text AS partner_contributor_type,
        v.country AS vendor_country,
        e.state AS event_state,
        e.name AS event_name,
        e.hours_summary,
        e.external_source
      FROM public.posts p
      JOIN public.vendors v ON v.id = p.vendor_id
      LEFT JOIN public.events e ON e.id = p.event_id
      WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
        AND p.co_approval_status IN (
          'APPROVED'::public.post_co_approval_status,
          'APPENDED'::public.post_co_approval_status,
          'PENDING'::public.post_co_approval_status
        )
        AND (
          p.contributor_id = ${profileId}::uuid
          OR p.partner_contributor_id = ${profileId}::uuid
          OR p.vendor_id IN (
            SELECT v2.id FROM public.vendors v2 WHERE v2.user_id = ${profileId}::uuid
          )
        )
      ORDER BY p.publish_at DESC
      LIMIT 50
    `);

    return rows
      .map((row) => {
        const isUsMarket = isUsMarketContext({
          vendorCountry: row.vendor_country,
          eventState: row.event_state,
          externalSource: row.external_source,
        });
        return {
          postId: row.id,
          caption: row.caption,
          mediaUrl: row.media_url,
          cdnMediaUrl: row.cdn_media_url,
          publishAt: row.publish_at,
          contributorType: row.contributor_type,
          partnerContributorType: row.partner_contributor_type,
          isUsMarket,
          eventName: row.event_name,
          operatingHours: row.hours_summary,
        };
      })
      .filter((row) => row.isUsMarket);
  }

  async hasActiveCollaboration(profileId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM public.posts p
          JOIN public.vendors v ON v.id = p.vendor_id
          LEFT JOIN public.events e ON e.id = p.event_id
          WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
            AND p.co_approval_status IN (
              'APPROVED'::public.post_co_approval_status,
              'APPENDED'::public.post_co_approval_status,
              'PENDING'::public.post_co_approval_status
            )
            AND (
              p.contributor_id = ${profileId}::uuid
              OR p.partner_contributor_id = ${profileId}::uuid
              OR p.vendor_id IN (
                SELECT v2.id FROM public.vendors v2 WHERE v2.user_id = ${profileId}::uuid
              )
            )
            AND (
              e.external_source = 'usda'
              OR v.country IS NULL
              OR UPPER(TRIM(v.country)) IN (
                'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA',
                'U.S.', 'U.S.A.', 'U.S.A', 'U.S'
              )
            )
        ) AS exists
      `,
    );
    return Boolean(rows[0]?.exists);
  }

  private async resolveShopperPreferences(userId?: string | null): Promise<{
    alertRadiusKm: number;
    preferredCategories: string[];
    latitude: number | null;
    longitude: number | null;
  }> {
    if (!userId) {
      return {
        alertRadiusKm: DEFAULT_ALERT_RADIUS_KM as number,
        preferredCategories: [],
        latitude: null,
        longitude: null,
      };
    }

    let alertRadiusKm: number = DEFAULT_ALERT_RADIUS_KM;
    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const settings = await this.prisma.$queryRaw<
        Array<{
          alert_radius_km: number | string | null;
          last_latitude: number | string | null;
          last_longitude: number | string | null;
        }>
      >(Prisma.sql`
        SELECT alert_radius_km, last_latitude, last_longitude
        FROM public.user_settings
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `);
      if (settings[0]) {
        alertRadiusKm = clampAlertRadiusKm(
          Number(settings[0].alert_radius_km),
        );
        latitude =
          settings[0].last_latitude != null
            ? Number(settings[0].last_latitude)
            : null;
        longitude =
          settings[0].last_longitude != null
            ? Number(settings[0].last_longitude)
            : null;
      }
    } catch {
      // user_settings may not exist until phase69/71 is applied.
    }

    let preferredCategories: string[] = [];
    try {
      const interests = await this.prisma.$queryRaw<
        Array<{ interests: string[] | null; shopper_interests: string[] | null }>
      >(Prisma.sql`
        SELECT
          s.interests,
          u.shopper_interests
        FROM public.users u
        LEFT JOIN public.shoppers s ON s.user_id = u.id
        WHERE u.id = ${userId}::uuid
        LIMIT 1
      `);
      preferredCategories = [
        ...(interests[0]?.interests ?? []),
        ...(interests[0]?.shopper_interests ?? []),
      ];
    } catch {
      preferredCategories = [];
    }

    return {
      alertRadiusKm,
      preferredCategories,
      latitude:
        latitude != null && Number.isFinite(latitude) ? latitude : null,
      longitude:
        longitude != null && Number.isFinite(longitude) ? longitude : null,
    };
  }

  private async loadPartnershipCandidates(
    limit: number,
  ): Promise<MakerFeedCandidate[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          vendor_id: string;
          event_id: string | null;
          caption: string;
          media_url: string | null;
          cdn_media_url: string | null;
          media_type: string;
          content_type: string | null;
          posting_mode: string | null;
          co_approval_status: string | null;
          contributor_id: string | null;
          contributor_type: string | null;
          partner_contributor_id: string | null;
          partner_contributor_type: string | null;
          contribution_metadata: unknown;
          publish_at: Date;
          vendor_name: string | null;
          vendor_lat: number | string | null;
          vendor_lng: number | string | null;
          vendor_country: string | null;
          vendor_specialties: string[] | null;
          partner_name: string | null;
          partner_specialties: string[] | null;
          event_name: string | null;
          event_lat: number | string | null;
          event_lng: number | string | null;
          event_city: string | null;
          event_state: string | null;
          event_address: string | null;
          hours_summary: string | null;
          external_source: string | null;
          external_id: string | null;
        }>
      >(Prisma.sql`
        SELECT
          p.id,
          p.vendor_id,
          p.event_id,
          p.caption,
          p.media_url,
          p.cdn_media_url,
          p.media_type,
          p.content_type::text AS content_type,
          p.posting_mode::text AS posting_mode,
          p.co_approval_status::text AS co_approval_status,
          p.contributor_id,
          p.contributor_type::text AS contributor_type,
          p.partner_contributor_id,
          p.partner_contributor_type::text AS partner_contributor_type,
          p.contribution_metadata,
          p.publish_at,
          v.business_name AS vendor_name,
          v.latitude AS vendor_lat,
          v.longitude AS vendor_lng,
          v.country AS vendor_country,
          COALESCE(vp.vendor_specialties, ARRAY[]::text[]) AS vendor_specialties,
          COALESCE(f.farm_name, pv.business_name, fp.role::text) AS partner_name,
          COALESCE(
            fp.farmer_specialties,
            fp.vendor_specialties,
            ARRAY[]::text[]
          ) AS partner_specialties,
          e.name AS event_name,
          e.latitude AS event_lat,
          e.longitude AS event_lng,
          e.city AS event_city,
          e.state AS event_state,
          e.address AS event_address,
          e.hours_summary,
          e.external_source,
          e.external_id
        FROM public.posts p
        JOIN public.vendors v ON v.id = p.vendor_id
        LEFT JOIN public.profiles vp ON vp.id = v.user_id
        LEFT JOIN public.profiles fp ON fp.id = p.partner_contributor_id
        LEFT JOIN public.farmers f ON f.user_id = p.partner_contributor_id
        LEFT JOIN public.vendors pv ON pv.user_id = p.partner_contributor_id
        LEFT JOIN public.events e ON e.id = p.event_id
        WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
          AND p.co_approval_status IN (
            'APPROVED'::public.post_co_approval_status,
            'APPENDED'::public.post_co_approval_status,
            'PENDING'::public.post_co_approval_status
          )
          AND (
            p.contributor_type = 'FARMER'::public.post_contributor_type
            OR p.partner_contributor_type = 'FARMER'::public.post_contributor_type
            OR EXISTS (
              SELECT 1 FROM public.farmers f2
              WHERE f2.user_id = p.contributor_id
                 OR f2.user_id = p.partner_contributor_id
            )
          )
          AND (
            e.external_source = 'usda'
            OR v.country IS NULL
            OR UPPER(TRIM(v.country)) IN (
              'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA',
              'U.S.', 'U.S.A.', 'U.S.A', 'U.S'
            )
          )
        ORDER BY p.publish_at DESC
        LIMIT ${limit}
      `);

      return rows
        .map((row) => {
          const parsed = parseUsdaExternalId(row.external_id);
          const isUsMarket = isUsMarketContext({
            vendorCountry: row.vendor_country,
            eventState: row.event_state,
            externalSource: row.external_source,
          });
          return {
            postId: row.id,
            vendorId: row.vendor_id,
            eventId: row.event_id,
            caption: row.caption,
            mediaUrl: row.media_url,
            cdnMediaUrl: row.cdn_media_url,
            mediaType: row.media_type,
            contentType: row.content_type ?? 'TEXT',
            postingMode: row.posting_mode ?? 'PARTNERSHIP',
            coApprovalStatus: row.co_approval_status ?? 'PENDING',
            contributorId: row.contributor_id,
            contributorType: row.contributor_type,
            partnerContributorId: row.partner_contributor_id,
            partnerContributorType: row.partner_contributor_type,
            contributionMetadata: row.contribution_metadata,
            publishAt: row.publish_at,
            vendorName: row.vendor_name,
            vendorLatitude:
              row.vendor_lat != null ? Number(row.vendor_lat) : null,
            vendorLongitude:
              row.vendor_lng != null ? Number(row.vendor_lng) : null,
            vendorCountry: row.vendor_country,
            vendorSpecialties: row.vendor_specialties ?? [],
            partnerName: row.partner_name,
            partnerSpecialties: row.partner_specialties ?? [],
            eventName: row.event_name,
            eventLatitude:
              row.event_lat != null ? Number(row.event_lat) : null,
            eventLongitude:
              row.event_lng != null ? Number(row.event_lng) : null,
            eventCity: row.event_city,
            eventState: row.event_state,
            eventAddress: row.event_address,
            eventHoursSummary: row.hours_summary,
            externalSource: row.external_source,
            externalId: row.external_id,
            isUsMarket,
            usdaListingId: parsed?.listingId ?? null,
            usdaDirectory: parsed?.directory ?? null,
            usdaHoursSummary: null,
            usdaSeasonLabel: null,
          };
        })
        .filter((row) => row.isUsMarket);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PARTNERSHIP_FEED_SYNCED DEGRADED ERROR=${message}`,
      );
      return [];
    }
  }

  private async enrichWithUsda(
    candidates: MakerFeedCandidate[],
    opts: { shopperLat?: number | null; shopperLng?: number | null },
  ): Promise<{
    candidates: MakerFeedCandidate[];
    usdaEnriched: number;
    directoryHits: number;
  }> {
    let usdaEnriched = 0;
    let directoryHits = 0;

    const detailCache = new Map<string, UsdaListingSnapshot | null>();
    const enriched = await Promise.all(
      candidates.map(async (candidate) => {
        if (!candidate.usdaListingId) return candidate;
        const cacheKey = `${candidate.usdaDirectory ?? 'farmersmarket'}:${candidate.usdaListingId}`;
        let snapshot = detailCache.get(cacheKey);
        if (snapshot === undefined) {
          snapshot = await enrichUsdaListingHours({
            listingId: candidate.usdaListingId,
            directory: (candidate.usdaDirectory as
              | 'farmersmarket'
              | 'csa'
              | 'agritourism'
              | 'foodhub'
              | 'onfarmmarket'
              | undefined) ?? 'farmersmarket',
            name: candidate.eventName,
          });
          detailCache.set(cacheKey, snapshot);
        }
        if (!snapshot) return candidate;
        usdaEnriched += 1;
        return {
          ...candidate,
          eventCity: snapshot.city ?? candidate.eventCity,
          eventState: snapshot.state ?? candidate.eventState,
          eventAddress: snapshot.address ?? candidate.eventAddress,
          eventLatitude: snapshot.latitude ?? candidate.eventLatitude,
          eventLongitude: snapshot.longitude ?? candidate.eventLongitude,
          usdaHoursSummary: snapshot.hoursSummary,
          usdaSeasonLabel: snapshot.seasonLabel,
          isUsMarket: true,
        };
      }),
    );

    // Soft directory sync: pull state listings when shopper location implies a US state.
    const stateHint =
      normalizeUsStateAbbr(
        enriched.find((c) => c.eventState)?.eventState ?? null,
      ) ?? null;
    if (stateHint && opts.shopperLat != null && opts.shopperLng != null) {
      const directory = await fetchUsdaFarmersMarketsByState(stateHint);
      directoryHits = directory.length;
    }

    return { candidates: enriched, usdaEnriched, directoryHits };
  }
}
