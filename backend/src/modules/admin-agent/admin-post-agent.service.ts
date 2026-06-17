import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AdminPostAiService } from './admin-post-ai.service';
import { AdminPostFeedbackService } from './admin-post-feedback.service';
import { moderationStatusForAiRecommendation } from './admin-post-feedback.util';
import {
  POST_MODERATION_AGENT_VERSION,
  type PostModerationAgentRunResult,
  type PostModerationProfile,
  type PostModerationResult,
} from './admin-post.types';

type PostRow = {
  id: string;
  vendor_id: string;
  post_type: string;
  caption: string;
  media_url: string | null;
  media_type: string;
  video_thumbnail_url: string | null;
  publish_at: Date;
  created_at: Date;
  business_name: string | null;
};

@Injectable()
export class AdminPostAgentService {
  private readonly logger = new Logger(AdminPostAgentService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AdminPostAiService,
    private readonly feedback: AdminPostFeedbackService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('ADMIN_POST_AGENT_ENABLED', 'false').toLowerCase() === 'true';
  }

  async run(trigger: 'scheduled' | 'manual' = 'scheduled'): Promise<PostModerationAgentRunResult> {
    if (this.running) {
      throw new Error('Admin post agent is already running');
    }

    this.running = true;
    const errors: string[] = [];
    let reviewed = 0;
    let suggestions = 0;
    let flagged = 0;
    let approved = 0;
    let skipped = 0;

    const batchSize = Number(this.config.get<string>('ADMIN_POST_MODERATION_BATCH', '25'));
    const delayMs = Number(this.config.get<string>('ADMIN_POST_MODERATION_DELAY_MS', '500'));

    const run = await this.prisma.adminAgentRun.create({
      data: {
        status: 'running',
        agentType: 'post_moderation',
        agentVersion: POST_MODERATION_AGENT_VERSION,
        notes: `trigger=${trigger}`,
      },
    });

    try {
      this.logger.log(`Post moderation agent run ${run.id} started (${trigger})`);
      const posts = await this.fetchPendingPosts(batchSize);
      const feedbackExamples = await this.feedback.loadTrainingExamples();

      for (const post of posts) {
        try {
          const profile = this.toProfile(post);
          const result = await this.ai.moderate(profile, feedbackExamples);
          await this.saveSuggestion(run.id, profile.id, result);
          await this.applyModerationStatus(profile.id, result.recommendation);
          reviewed += 1;
          suggestions += 1;
          if (result.recommendation === 'approve') approved += 1;
          else flagged += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${post.id}: ${message}`);
          skipped += 1;
        }

        if (delayMs > 0) await sleep(delayMs);
      }

      const status = errors.length > 0 ? (suggestions > 0 ? 'partial' : 'failed') : 'success';
      await this.prisma.adminAgentRun.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt: new Date(),
          reviewed,
          suggestionsCount: suggestions,
          skipped,
          errors,
          notes: `trigger=${trigger}; flagged=${flagged}; approved=${approved}`,
        },
      });

      return {
        runId: run.id,
        status,
        reviewed,
        suggestions,
        flagged,
        approved,
        skipped,
        errors,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      await this.prisma.adminAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          reviewed,
          suggestionsCount: suggestions,
          skipped,
          errors,
        },
      });
      throw err;
    } finally {
      this.running = false;
    }
  }

  async moderatePost(postId: string): Promise<PostModerationResult & { suggestionId: string }> {
    const rows = await this.prisma.$queryRaw<PostRow[]>`
      select
        p.id,
        p.vendor_id,
        p.post_type,
        p.caption,
        p.media_url,
        p.media_type,
        p.video_thumbnail_url,
        p.publish_at,
        p.created_at,
        v.business_name
      from posts p
      join vendors v on v.id = p.vendor_id
      where p.id = ${postId}::uuid
      limit 1
    `;

    const post = rows[0];
    if (!post) throw new Error('Post not found');

    const profile = this.toProfile(post);
    const feedbackExamples = await this.feedback.loadTrainingExamples();
    const result = await this.ai.moderate(profile, feedbackExamples);
    const suggestion = await this.saveSuggestion(null, profile.id, result);
    await this.applyModerationStatus(profile.id, result.recommendation);

    return { ...result, suggestionId: suggestion.id };
  }

  async latestSuggestion(postId: string) {
    return this.prisma.postModerationSuggestion.findFirst({
      where: { postId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async fetchPendingPosts(limit: number): Promise<PostRow[]> {
    return this.prisma.$queryRaw<PostRow[]>`
      select
        p.id,
        p.vendor_id,
        p.post_type,
        p.caption,
        p.media_url,
        p.media_type,
        p.video_thumbnail_url,
        p.publish_at,
        p.created_at,
        v.business_name
      from posts p
      join vendors v on v.id = p.vendor_id
      where p.moderation_status = 'unreviewed'
        and p.publish_at <= now()
      order by p.created_at asc
      limit ${limit}
    `;
  }

  private toProfile(post: PostRow): PostModerationProfile {
    return {
      id: post.id,
      vendorId: post.vendor_id,
      vendorName: post.business_name,
      postType: post.post_type,
      caption: post.caption,
      mediaUrl: post.media_url,
      mediaType: post.media_type ?? 'image',
      videoThumbnailUrl: post.video_thumbnail_url,
      publishAt: post.publish_at,
      createdAt: post.created_at,
    };
  }

  private async applyModerationStatus(
    postId: string,
    recommendation: PostModerationResult['recommendation'],
  ) {
    const status = moderationStatusForAiRecommendation(recommendation);
    await this.prisma.$executeRaw`
      update posts
      set moderation_status = ${status}
      where id = ${postId}::uuid
    `;
  }

  private async saveSuggestion(
    runId: string | null,
    postId: string,
    result: PostModerationResult,
  ) {
    return this.prisma.postModerationSuggestion.create({
      data: {
        runId,
        postId,
        recommendation: result.recommendation,
        confidence: new Prisma.Decimal(result.confidence.toFixed(3)),
        summary: result.summary,
        categories: result.categories,
        flags: result.flags,
        reasons: result.reasons,
        agentVersion: POST_MODERATION_AGENT_VERSION,
      },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
