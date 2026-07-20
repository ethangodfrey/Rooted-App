import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartnerNotifyService {
  private readonly logger = new Logger(PartnerNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async enqueueDashboardNotification(input: {
    userId: string;
    title: string;
    body: string;
    type: 'PERFORMANCE_REPORT' | 'PERFORMANCE_ANOMALY' | 'SYSTEM_ALERT';
  }): Promise<string | null> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT public.enqueue_notification(
          ${input.userId}::uuid,
          ${input.title},
          ${input.body},
          ${input.type}::public.notification_type
        ) AS id
      `);
      return rows[0]?.id ?? null;
    } catch {
      try {
        const fallback = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          INSERT INTO public.notification_logs (
            user_id, title, body, notification_type
          ) VALUES (
            ${input.userId}::uuid,
            ${input.title},
            ${input.body},
            'SYSTEM_ALERT'::public.notification_type
          )
          RETURNING id
        `);
        return fallback[0]?.id ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`PARTNER_NOTIFY_DASHBOARD_SKIPPED ERROR=${message}`);
        return null;
      }
    }
  }

  /**
   * Email delivery — uses RESEND_API_KEY when configured; otherwise marks SKIPPED
   * and logs the outbound payload for ops.
   */
  async sendPartnerEmail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from =
      this.config.get<string>('PARTNER_REPORT_FROM_EMAIL')?.trim() ||
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      'reports@vendorly.local';

    if (!apiKey || !input.to.trim()) {
      this.logger.log(
        `PARTNER_EMAIL_SKIPPED TO=${input.to || 'NONE'} SUBJECT=${input.subject}`,
      );
      return 'SKIPPED';
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to.trim()],
          subject: input.subject,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(
          `PARTNER_EMAIL_FAILED STATUS=${res.status} DETAIL=${body.slice(0, 200)}`,
        );
        return 'FAILED';
      }
      this.logger.log(`PARTNER_EMAIL_SENT TO=${input.to}`);
      return 'SENT';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`PARTNER_EMAIL_FAILED ERROR=${message}`);
      return 'FAILED';
    }
  }
}
