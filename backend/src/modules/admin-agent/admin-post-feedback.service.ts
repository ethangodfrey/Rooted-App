import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import type { PostModerationFeedbackExample } from './admin-post.types';

type FeedbackRow = {
  outcome: string;
  ai_recommendation: string | null;
  admin_action: string;
  notes: string | null;
  post_snapshot: {
    caption?: string | null;
    media_type?: string | null;
    categories?: string[] | null;
  } | null;
};

@Injectable()
export class AdminPostFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async loadTrainingExamples(limit?: number): Promise<PostModerationFeedbackExample[]> {
    const take = limit ?? Number(this.config.get<string>('ADMIN_POST_FEEDBACK_EXAMPLES', '15'));

    const rows = await this.prisma.$queryRaw<FeedbackRow[]>`
      select outcome, ai_recommendation, admin_action, notes, post_snapshot
      from post_moderation_feedback
      order by created_at desc
      limit ${take}
    `;

    return rows.map((row) => {
      const snapshot = row.post_snapshot ?? {};
      return {
        outcome: row.outcome as PostModerationFeedbackExample['outcome'],
        aiRecommendation: row.ai_recommendation as PostModerationFeedbackExample['aiRecommendation'],
        adminAction: row.admin_action as PostModerationFeedbackExample['adminAction'],
        caption: snapshot.caption ?? null,
        mediaType: snapshot.media_type ?? null,
        categories: snapshot.categories ?? [],
        notes: row.notes,
      };
    });
  }

  async stats() {
    const rows = await this.prisma.$queryRaw<{ outcome: string; count: bigint }[]>`
      select outcome, count(*)::bigint as count
      from post_moderation_feedback
      group by outcome
    `;

    const byOutcome = Object.fromEntries(rows.map((row) => [row.outcome, Number(row.count)]));
    return {
      total:
        (byOutcome.accepted ?? 0) +
        (byOutcome.overridden ?? 0) +
        (byOutcome.no_ai_suggestion ?? 0),
      accepted: byOutcome.accepted ?? 0,
      overridden: byOutcome.overridden ?? 0,
      noAiSuggestion: byOutcome.no_ai_suggestion ?? 0,
    };
  }
}
