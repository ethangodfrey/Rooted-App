import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  formatDeepLinkingVerifiedLog,
  marketDeepLink,
} from './market-notification.deep-link';
import {
  evaluateMarketAlert,
  filterMarketsStartingSoon,
  type MarketAlertDecision,
  type MarketEventStart,
  type ShopperAlertCandidate,
} from './market-notification.evaluator';

export type MarketNotificationDispatchResult = {
  CANDIDATES: number;
  DISPATCHED: number;
  SKIPPED_DEDUPE: number;
  SKIPPED_OUT_OF_RADIUS: number;
  ERRORS: number;
};

/**
 * Tracks market event start times vs shopper geolocation preferences and
 * enqueues MARKET_ALERT notifications with deep links to /markets/:market_id.
 */
@Injectable()
export class MarketNotificationService implements OnModuleInit {
  private readonly logger = new Logger(MarketNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(
      'NOTIFICATION_SERVICE_INITIALIZED SERVICE=MarketNotificationService TYPE=MARKET_ALERT',
    );
  }

  async listShoppersWithGeoAlerts(): Promise<ShopperAlertCandidate[]> {
    type Row = {
      user_id: string;
      enable_market_alerts: boolean;
      alert_radius_km: number;
      last_latitude: number;
      last_longitude: number;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        us.user_id,
        us.enable_market_alerts,
        us.alert_radius_km::float8 AS alert_radius_km,
        us.last_latitude::float8 AS last_latitude,
        us.last_longitude::float8 AS last_longitude
      FROM public.user_settings us
      WHERE us.enable_market_alerts = true
        AND us.last_latitude IS NOT NULL
        AND us.last_longitude IS NOT NULL
    `);

    return rows.map((row) => ({
      userId: row.user_id,
      enableMarketAlerts: row.enable_market_alerts,
      alertRadiusKm: Number(row.alert_radius_km),
      latitude: Number(row.last_latitude),
      longitude: Number(row.last_longitude),
    }));
  }

  async listMarketsStartingSoon(now = new Date()): Promise<MarketEventStart[]> {
    type Row = {
      id: string;
      name: string;
      start_datetime: Date;
      latitude: number;
      longitude: number;
    };

    const lookBack = new Date(now.getTime() - 5 * 60 * 1000);
    const lookAhead = new Date(now.getTime() + 30 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        e.id,
        e.name,
        e.start_datetime,
        e.latitude::float8 AS latitude,
        e.longitude::float8 AS longitude
      FROM public.events e
      WHERE e.visibility_status = 'public'
        AND e.start_datetime >= ${lookBack}
        AND e.start_datetime <= ${lookAhead}
        AND e.latitude IS NOT NULL
        AND e.longitude IS NOT NULL
    `);

    const markets = rows.map((row) => ({
      marketId: row.id,
      name: row.name,
      startDatetime: new Date(row.start_datetime),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));

    return filterMarketsStartingSoon(markets, now);
  }

  async dispatchStartingMarketAlerts(
    now = new Date(),
  ): Promise<MarketNotificationDispatchResult> {
    const [shoppers, markets] = await Promise.all([
      this.listShoppersWithGeoAlerts(),
      this.listMarketsStartingSoon(now),
    ]);

    let dispatched = 0;
    let skippedDedupe = 0;
    let skippedOutOfRadius = 0;
    let errors = 0;
    let candidates = 0;

    for (const shopper of shoppers) {
      for (const market of markets) {
        candidates += 1;
        const decision = evaluateMarketAlert(shopper, market);
        if (!decision) {
          skippedOutOfRadius += 1;
          continue;
        }

        try {
          const inserted = await this.dispatchOne(decision, market.startDatetime);
          if (inserted) {
            dispatched += 1;
            this.logger.log(
              formatDeepLinkingVerifiedLog({
                marketId: decision.marketId,
                deepLink: decision.payload.deep_link,
              }),
            );
          } else {
            skippedDedupe += 1;
          }
        } catch (err) {
          errors += 1;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `MARKET_ALERT_DISPATCH_FAILED USER=${decision.userId} MARKET=${decision.marketId} ERROR=${message}`,
          );
        }
      }
    }

    this.logger.log(
      `MARKET_ALERT_SWEEP_COMPLETED CANDIDATES=${candidates} DISPATCHED=${dispatched} SKIPPED_DEDUPE=${skippedDedupe} SKIPPED_RADIUS=${skippedOutOfRadius} ERRORS=${errors}`,
    );

    return {
      CANDIDATES: candidates,
      DISPATCHED: dispatched,
      SKIPPED_DEDUPE: skippedDedupe,
      SKIPPED_OUT_OF_RADIUS: skippedOutOfRadius,
      ERRORS: errors,
    };
  }

  /**
   * Claim dedupe slot then insert notification. Returns false when already dispatched.
   */
  async dispatchOne(
    decision: MarketAlertDecision,
    eventStartAt: Date,
  ): Promise<boolean> {
    const deepLink = marketDeepLink(decision.marketId);

    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.market_alert_dispatches (
        user_id,
        market_id,
        event_start_at,
        distance_km
      ) VALUES (
        ${decision.userId}::uuid,
        ${decision.marketId}::uuid,
        ${eventStartAt},
        ${decision.distanceKm}
      )
      ON CONFLICT (user_id, market_id, event_start_at) DO NOTHING
      RETURNING id
    `);

    if (!claimed.length) {
      return false;
    }

    const dispatchId = claimed[0].id;

    try {
      const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO public.notification_logs (
          user_id,
          title,
          body,
          notification_type,
          market_id,
          deep_link,
          payload
        ) VALUES (
          ${decision.userId}::uuid,
          ${decision.title},
          ${decision.body},
          'MARKET_ALERT'::public.notification_type,
          ${decision.marketId}::uuid,
          ${deepLink},
          ${JSON.stringify(decision.payload)}::jsonb
        )
        RETURNING id
      `);

      const notificationId = inserted[0]?.id;
      if (notificationId) {
        await this.prisma.$executeRaw`
          UPDATE public.market_alert_dispatches
          SET notification_id = ${notificationId}::uuid
          WHERE id = ${dispatchId}::uuid
        `;
      }
      return true;
    } catch (err) {
      // Fallback RPC when columns/enum already applied via helper
      try {
        await this.prisma.$executeRaw`
          SELECT public.enqueue_market_notification(
            ${decision.userId}::uuid,
            ${decision.title},
            ${decision.body},
            ${decision.marketId}::uuid,
            ${deepLink},
            ${JSON.stringify(decision.payload)}::jsonb
          )
        `;
        return true;
      } catch {
        throw err;
      }
    }
  }
}
