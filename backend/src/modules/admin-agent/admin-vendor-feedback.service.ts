import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import type { VendorReviewFeedbackExample } from './admin-agent.types';

type FeedbackRow = {
  outcome: string;
  ai_recommendation: string | null;
  admin_action: string;
  notes: string | null;
  vendor_snapshot: {
    category?: string | null;
    product_summary?: string | null;
    sell_city?: string | null;
    sell_state?: string | null;
    selling_channels?: string[] | null;
  } | null;
};

@Injectable()
export class AdminVendorFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async loadTrainingExamples(limit?: number): Promise<VendorReviewFeedbackExample[]> {
    const take = limit ?? Number(this.config.get<string>('ADMIN_VENDOR_FEEDBACK_EXAMPLES', '15'));

    const rows = await this.prisma.$queryRaw<FeedbackRow[]>`
      select outcome, ai_recommendation, admin_action, notes, vendor_snapshot
      from vendor_review_feedback
      order by created_at desc
      limit ${take}
    `;

    return rows.map((row) => {
      const snapshot = row.vendor_snapshot ?? {};
      return {
        outcome: row.outcome as VendorReviewFeedbackExample['outcome'],
        aiRecommendation: row.ai_recommendation as VendorReviewFeedbackExample['aiRecommendation'],
        adminAction: row.admin_action as VendorReviewFeedbackExample['adminAction'],
        category: snapshot.category ?? null,
        productSummary: snapshot.product_summary ?? null,
        sellCity: snapshot.sell_city ?? null,
        sellState: snapshot.sell_state ?? null,
        sellingChannels: snapshot.selling_channels ?? [],
        notes: row.notes,
      };
    });
  }

  async stats() {
    const rows = await this.prisma.$queryRaw<{ outcome: string; count: bigint }[]>`
      select outcome, count(*)::bigint as count
      from vendor_review_feedback
      group by outcome
    `;

    const byOutcome = Object.fromEntries(rows.map((row) => [row.outcome, Number(row.count)]));
    const total =
      (byOutcome.accepted ?? 0) +
      (byOutcome.overridden ?? 0) +
      (byOutcome.no_ai_suggestion ?? 0);

    return {
      total,
      accepted: byOutcome.accepted ?? 0,
      overridden: byOutcome.overridden ?? 0,
      noAiSuggestion: byOutcome.no_ai_suggestion ?? 0,
    };
  }
}
