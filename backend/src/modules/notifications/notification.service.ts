/**
 * NotificationService — mock Email/SMS dispatch + preferences + audit log.
 * Telemetry: NOTIFICATION_ENGINE_ACTIVE, EVENT_DISPATCHED
 *
 * External providers (SendGrid / Twilio) replace console mocks later.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  formatEventDispatchedLog,
  formatNotificationEngineActiveLog,
  normalizeNotificationPreferences,
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationStatus,
} from './notification.util';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatNotificationEngineActiveLog());
    this.logger.log(formatEventDispatchedLog());
  }

  /**
   * Mock SendGrid-ready email sender.
   * Never throws — failures are logged and recorded as FAILED.
   */
  async sendEmail(to: string, subject: string, body: string): Promise<{
    STATUS: NotificationStatus;
    CHANNEL: 'EMAIL';
  }> {
    const destination = (to ?? '').trim();
    if (!destination) {
      console.log('EVENT_DISPATCHED CHANNEL=EMAIL STATUS=FAILED REASON=NO_DESTINATION');
      return { STATUS: 'FAILED', CHANNEL: 'EMAIL' };
    }
    try {
      console.log(
        `EVENT_DISPATCHED CHANNEL=EMAIL TO=${destination} SUBJECT=${subject.replace(/\s+/g, '_')}`,
      );
      console.log(`NOTIFICATION_ENGINE_ACTIVE MOCK_EMAIL_BODY=${body.slice(0, 120)}`);
      this.logger.log(
        formatEventDispatchedLog({
          channel: 'EMAIL',
          status: 'SENT',
        }),
      );
      return { STATUS: 'SENT', CHANNEL: 'EMAIL' };
    } catch (err) {
      console.log(
        `EVENT_DISPATCHED CHANNEL=EMAIL STATUS=FAILED ERROR=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { STATUS: 'FAILED', CHANNEL: 'EMAIL' };
    }
  }

  /**
   * Mock Twilio-ready SMS sender.
   * Never throws — failures are logged and recorded as FAILED.
   */
  async sendSMS(to: string, body: string): Promise<{
    STATUS: NotificationStatus;
    CHANNEL: 'SMS';
  }> {
    const destination = (to ?? '').trim();
    if (!destination) {
      console.log('EVENT_DISPATCHED CHANNEL=SMS STATUS=FAILED REASON=NO_DESTINATION');
      return { STATUS: 'FAILED', CHANNEL: 'SMS' };
    }
    try {
      console.log(
        `EVENT_DISPATCHED CHANNEL=SMS TO=${destination} BODY=${body.slice(0, 80).replace(/\s+/g, '_')}`,
      );
      this.logger.log(
        formatEventDispatchedLog({
          channel: 'SMS',
          status: 'SENT',
        }),
      );
      return { STATUS: 'SENT', CHANNEL: 'SMS' };
    } catch (err) {
      console.log(
        `EVENT_DISPATCHED CHANNEL=SMS STATUS=FAILED ERROR=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { STATUS: 'FAILED', CHANNEL: 'SMS' };
    }
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const rows = await this.prisma.$queryRaw<
      Array<{ notification_preferences: unknown }>
    >(Prisma.sql`
      SELECT notification_preferences
      FROM public.users
      WHERE id = ${userId}::uuid
      LIMIT 1
    `);
    return normalizeNotificationPreferences(rows[0]?.notification_preferences);
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const next: NotificationPreferences = {
      emailEnabled:
        typeof prefs.emailEnabled === 'boolean'
          ? prefs.emailEnabled
          : current.emailEnabled,
      smsEnabled:
        typeof prefs.smsEnabled === 'boolean'
          ? prefs.smsEnabled
          : current.smsEnabled,
    };
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.users
      SET
        notification_preferences = ${JSON.stringify(next)}::jsonb,
        updated_at = NOW()
      WHERE id = ${userId}::uuid
    `);
    this.logger.log(
      `NOTIFICATION_ENGINE_ACTIVE ACTION=PREFS_UPDATED USER=${userId} EMAIL=${next.emailEnabled} SMS=${next.smsEnabled}`,
    );
    return next;
  }

  /**
   * Logistics: SMS vendor when their delivery stop is DELIVERED.
   * Non-blocking — call with void / catch externally.
   */
  async notifyVendorStopDelivered(input: {
    vendorId: string;
    stopId: string;
    procurementRequestId: string;
  }): Promise<void> {
    const contact = await this.resolveVendorContact(input.vendorId);
    if (!contact) return;
    const prefs = normalizeNotificationPreferences(contact.notification_preferences);
    if (!prefs.smsEnabled) {
      this.logger.log(
        `NOTIFICATION_ENGINE_ACTIVE SKIP=SMS_DISABLED USER=${contact.user_id}`,
      );
      return;
    }
    const body = `Vendorly: your delivery stop ${input.stopId.slice(0, 8)} was marked DELIVERED (order ${input.procurementRequestId.slice(0, 8)}).`;
    const result = await this.sendSMS(contact.phone ?? '', body);
    await this.writeLog({
      userId: contact.user_id,
      channel: 'SMS',
      eventType: 'DELIVERY_STOP_DELIVERED',
      status: result.STATUS,
      destination: contact.phone,
      body,
      metadata: {
        vendorId: input.vendorId,
        stopId: input.stopId,
        procurementRequestId: input.procurementRequestId,
      },
    });
  }

  /**
   * Escrow: Email receipt when funds are SETTLED to vendor or farmer.
   */
  async notifyEscrowSettled(input: {
    destinationType: 'VENDOR' | 'FARMER';
    destinationId: string;
    transactionId: string;
    netAmountCents: number;
  }): Promise<void> {
    const contact =
      input.destinationType === 'VENDOR'
        ? await this.resolveVendorContact(input.destinationId)
        : await this.resolveFarmerContact(input.destinationId);
    if (!contact) return;
    const prefs = normalizeNotificationPreferences(contact.notification_preferences);
    if (!prefs.emailEnabled) {
      this.logger.log(
        `NOTIFICATION_ENGINE_ACTIVE SKIP=EMAIL_DISABLED USER=${contact.user_id}`,
      );
      return;
    }
    const dollars = `$${(Math.max(0, input.netAmountCents) / 100).toFixed(2)}`;
    const subject = 'Vendorly escrow settled';
    const body = `Your escrow hold ${input.transactionId.slice(0, 8)} is SETTLED. Available balance increased by ${dollars}.`;
    const result = await this.sendEmail(contact.email ?? '', subject, body);
    await this.writeLog({
      userId: contact.user_id,
      channel: 'EMAIL',
      eventType: 'ESCROW_SETTLED',
      status: result.STATUS,
      destination: contact.email,
      subject,
      body,
      metadata: {
        destinationType: input.destinationType,
        destinationId: input.destinationId,
        transactionId: input.transactionId,
        netAmountCents: input.netAmountCents,
      },
    });
  }

  /**
   * Disputes: Email initiator when dispute is resolved.
   */
  async notifyDisputeResolved(input: {
    initiatorId: string;
    disputeId: string;
    resolution: 'RESOLVED_REFUNDED' | 'RESOLVED_RELEASED';
  }): Promise<void> {
    const contact = await this.resolveUserContact(input.initiatorId);
    if (!contact) return;
    const prefs = normalizeNotificationPreferences(contact.notification_preferences);
    if (!prefs.emailEnabled) {
      this.logger.log(
        `NOTIFICATION_ENGINE_ACTIVE SKIP=EMAIL_DISABLED USER=${contact.user_id}`,
      );
      return;
    }
    const subject = `Vendorly dispute ${input.resolution}`;
    const body =
      input.resolution === 'RESOLVED_REFUNDED'
        ? `Your dispute ${input.disputeId.slice(0, 8)} was resolved with a refund.`
        : `Your dispute ${input.disputeId.slice(0, 8)} was dismissed and escrow was released back to hold.`;
    const result = await this.sendEmail(contact.email ?? '', subject, body);
    await this.writeLog({
      userId: contact.user_id,
      channel: 'EMAIL',
      eventType: 'DISPUTE_RESOLVED',
      status: result.STATUS,
      destination: contact.email,
      subject,
      body,
      metadata: {
        disputeId: input.disputeId,
        resolution: input.resolution,
      },
    });
  }

  /** Fire-and-forget wrapper so callers never block on notifications. */
  dispatchSafe(task: Promise<void>): void {
    void task.catch((err) => {
      this.logger.warn(
        `NOTIFICATION_ENGINE_ACTIVE DISPATCH_ERROR ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private async writeLog(input: {
    userId: string;
    channel: NotificationChannel;
    eventType: string;
    status: NotificationStatus;
    destination?: string | null;
    subject?: string | null;
    body?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.notifications_log (
          user_id, channel, event_type, status, destination, subject, body, metadata
        ) VALUES (
          ${input.userId}::uuid,
          ${input.channel}::public.notification_channel,
          ${input.eventType},
          ${input.status}::public.notification_status,
          ${input.destination ?? null},
          ${input.subject ?? null},
          ${input.body ?? null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb
        )
      `);
      this.logger.log(
        formatEventDispatchedLog({
          channel: input.channel,
          eventType: input.eventType,
          status: input.status,
          userId: input.userId,
        }),
      );
    } catch (err) {
      // Table may not exist yet in local envs — never block callers.
      this.logger.warn(
        `NOTIFICATION_ENGINE_ACTIVE LOG_WRITE_FAILED ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async resolveUserContact(userId: string): Promise<{
    user_id: string;
    email: string | null;
    phone: string | null;
    notification_preferences: unknown;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        email: string | null;
        phone: string | null;
        notification_preferences: unknown;
      }>
    >(Prisma.sql`
      SELECT
        id AS user_id,
        email,
        phone,
        notification_preferences
      FROM public.users
      WHERE id = ${userId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async resolveVendorContact(vendorId: string): Promise<{
    user_id: string;
    email: string | null;
    phone: string | null;
    notification_preferences: unknown;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        email: string | null;
        phone: string | null;
        notification_preferences: unknown;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u.phone,
        u.notification_preferences
      FROM public.vendors v
      JOIN public.users u ON u.id = v.user_id
      WHERE v.id = ${vendorId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async resolveFarmerContact(farmerId: string): Promise<{
    user_id: string;
    email: string | null;
    phone: string | null;
    notification_preferences: unknown;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        email: string | null;
        phone: string | null;
        notification_preferences: unknown;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u.phone,
        u.notification_preferences
      FROM public.farmers f
      JOIN public.users u ON u.id = f.user_id
      WHERE f.id = ${farmerId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}
