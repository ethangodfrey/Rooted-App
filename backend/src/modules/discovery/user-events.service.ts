import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { isUsMarketContext } from './meet-the-makers-usda.util';

export type UserEventRsvp = {
  id: string;
  userId: string;
  eventId: string;
  postId: string | null;
  status: string;
  createdAt: Date;
  eventName?: string | null;
  eventStart?: Date | null;
};

@Injectable()
export class UserEventsService {
  private readonly logger = new Logger(UserEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async rsvp(input: {
    userId: string;
    eventId: string;
    postId?: string | null;
  }): Promise<UserEventRsvp> {
    if (!input.eventId?.trim()) {
      throw new BadRequestException('EVENT_ID_REQUIRED');
    }

    await this.assertUsMarketEvent(input.eventId);

    try {
      const postIdSql = input.postId
        ? Prisma.sql`${input.postId}::uuid`
        : Prisma.sql`NULL`;

      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          event_id: string;
          post_id: string | null;
          status: string;
          created_at: Date;
        }>
      >(Prisma.sql`
        INSERT INTO public.user_events (user_id, event_id, post_id, status)
        VALUES (
          ${input.userId}::uuid,
          ${input.eventId}::uuid,
          ${postIdSql},
          'RSVP'
        )
        ON CONFLICT (user_id, event_id)
        DO UPDATE SET
          status = 'RSVP',
          post_id = COALESCE(EXCLUDED.post_id, public.user_events.post_id),
          updated_at = NOW()
        RETURNING id, user_id, event_id, post_id, status, created_at
      `);

      const row = rows[0];
      this.logger.log(
        `PARTNERSHIP_FEED_SYNCED ACTION=RSVP USER=${input.userId} EVENT=${input.eventId}`,
      );
      return {
        id: row.id,
        userId: row.user_id,
        eventId: row.event_id,
        postId: row.post_id,
        status: row.status,
        createdAt: row.created_at,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('user_events_event_fk') || message.includes('foreign key')) {
        throw new BadRequestException('EVENT_NOT_FOUND');
      }
      if (message.includes('duplicate') || message.includes('unique')) {
        throw new ConflictException('RSVP_EXISTS');
      }
      throw err;
    }
  }

  async cancelRsvp(input: {
    userId: string;
    eventId: string;
  }): Promise<{ STATUS: string }> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM public.user_events
      WHERE user_id = ${input.userId}::uuid
        AND event_id = ${input.eventId}::uuid
    `);
    return { STATUS: 'RSVP_CANCELLED' };
  }

  async listSchedule(userId: string): Promise<UserEventRsvp[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          event_id: string;
          post_id: string | null;
          status: string;
          created_at: Date;
          event_name: string | null;
          start_datetime: Date | null;
        }>
      >(Prisma.sql`
        SELECT
          ue.id,
          ue.user_id,
          ue.event_id,
          ue.post_id,
          ue.status,
          ue.created_at,
          e.name AS event_name,
          e.start_datetime
        FROM public.user_events ue
        LEFT JOIN public.events e ON e.id = ue.event_id
        WHERE ue.user_id = ${userId}::uuid
          AND ue.status = 'RSVP'
        ORDER BY COALESCE(e.start_datetime, ue.created_at) ASC
      `);

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        eventId: row.event_id,
        postId: row.post_id,
        status: row.status,
        createdAt: row.created_at,
        eventName: row.event_name,
        eventStart: row.start_datetime,
      }));
    } catch {
      return [];
    }
  }

  private async assertUsMarketEvent(eventId: string): Promise<void> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          state: string | null;
          external_source: string | null;
        }>
      >(Prisma.sql`
        SELECT state, external_source
        FROM public.events
        WHERE id = ${eventId}::uuid
        LIMIT 1
      `);
      const event = rows[0];
      if (!event) {
        throw new BadRequestException('EVENT_NOT_FOUND');
      }
      const ok = isUsMarketContext({
        vendorCountry: 'US',
        eventState: event.state,
        externalSource: event.external_source,
      });
      // When state is blank (legacy seeds), allow RSVP; reject non-US states.
      if (!ok && event.state?.trim()) {
        throw new BadRequestException('US_MARKET_REQUIRED');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // If events lookup fails, allow RSVP insert to surface FK errors.
    }
  }
}
