import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AdminVendorAiService } from './admin-vendor-ai.service';
import { AdminVendorFeedbackService } from './admin-vendor-feedback.service';
import {
  ADMIN_AGENT_VERSION,
  type AdminAgentRunResult,
  type VendorApplicationProfile,
  type VendorReviewResult,
} from './admin-agent.types';

type VendorRow = {
  id: string;
  business_name: string | null;
  business_description: string | null;
  category: string | null;
  product_summary: string | null;
  sell_city: string | null;
  sell_state: string | null;
  selling_channels: string[] | null;
  primary_market: string | null;
  instagram_url: string | null;
  website_url: string | null;
  application_submitted_at: Date | null;
  created_at: Date;
  user_email: string | null;
  user_name: string | null;
};

@Injectable()
export class AdminVendorAgentService {
  private readonly logger = new Logger(AdminVendorAgentService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AdminVendorAiService,
    private readonly feedback: AdminVendorFeedbackService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('ADMIN_VENDOR_AGENT_ENABLED', 'false').toLowerCase() === 'true';
  }

  async run(trigger: 'scheduled' | 'manual' = 'scheduled'): Promise<AdminAgentRunResult> {
    if (this.running) {
      throw new Error('Admin vendor agent is already running');
    }

    this.running = true;
    const errors: string[] = [];
    let reviewed = 0;
    let suggestions = 0;
    let skipped = 0;

    const batchSize = Number(this.config.get<string>('ADMIN_VENDOR_REVIEW_BATCH', '20'));
    const delayMs = Number(this.config.get<string>('ADMIN_VENDOR_REVIEW_DELAY_MS', '400'));

    const run = await this.prisma.adminAgentRun.create({
      data: {
        status: 'running',
        agentType: 'vendor_review',
        agentVersion: ADMIN_AGENT_VERSION,
        notes: `trigger=${trigger}`,
      },
    });

    try {
      this.logger.log(`Admin vendor agent run ${run.id} started (${trigger})`);
      const vendors = await this.fetchPendingVendors(batchSize);
      const feedbackExamples = await this.feedback.loadTrainingExamples();

      for (const vendor of vendors) {
        try {
          const profile = this.toProfile(vendor);
          const result = await this.ai.review(profile, feedbackExamples);
          await this.saveSuggestion(run.id, profile.id, result);
          reviewed += 1;
          suggestions += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${vendor.id}: ${message}`);
          skipped += 1;
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
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
        },
      });

      return {
        runId: run.id,
        status,
        reviewed,
        suggestions,
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

  async reviewVendor(vendorId: string): Promise<VendorReviewResult & { suggestionId: string }> {
    const rows = await this.prisma.$queryRaw<VendorRow[]>`
      select
        v.id,
        v.business_name,
        v.business_description,
        v.category,
        v.product_summary,
        v.sell_city,
        v.sell_state,
        v.selling_channels,
        v.primary_market,
        v.instagram_url,
        v.website_url,
        v.application_submitted_at,
        v.created_at,
        u.email as user_email,
        u.name as user_name
      from vendors v
      join users u on u.id = v.user_id
      where v.id = ${vendorId}::uuid
      limit 1
    `;

    const vendor = rows[0];
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const profile = this.toProfile(vendor);
    const feedbackExamples = await this.feedback.loadTrainingExamples();
    const result = await this.ai.review(profile, feedbackExamples);
    const suggestion = await this.saveSuggestion(null, profile.id, result);

    return { ...result, suggestionId: suggestion.id };
  }

  async latestSuggestion(vendorId: string) {
    return this.prisma.vendorReviewSuggestion.findFirst({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async fetchPendingVendors(limit: number): Promise<VendorRow[]> {
    return this.prisma.$queryRaw<VendorRow[]>`
      select
        v.id,
        v.business_name,
        v.business_description,
        v.category,
        v.product_summary,
        v.sell_city,
        v.sell_state,
        v.selling_channels,
        v.primary_market,
        v.instagram_url,
        v.website_url,
        v.application_submitted_at,
        v.created_at,
        u.email as user_email,
        u.name as user_name
      from vendors v
      join users u on u.id = v.user_id
      where v.approval_status = 'pending'
        and v.application_submitted_at is not null
      order by v.application_submitted_at asc
      limit ${limit}
    `;
  }

  private toProfile(vendor: VendorRow): VendorApplicationProfile {
    return {
      id: vendor.id,
      businessName: vendor.business_name,
      businessDescription: vendor.business_description,
      category: vendor.category,
      productSummary: vendor.product_summary,
      sellCity: vendor.sell_city,
      sellState: vendor.sell_state,
      sellingChannels: vendor.selling_channels ?? [],
      primaryMarket: vendor.primary_market,
      instagramUrl: vendor.instagram_url,
      websiteUrl: vendor.website_url,
      applicationSubmittedAt: vendor.application_submitted_at,
      createdAt: vendor.created_at,
      userEmail: vendor.user_email,
      userName: vendor.user_name,
    };
  }

  private async saveSuggestion(
    runId: string | null,
    vendorId: string,
    result: VendorReviewResult,
  ) {
    return this.prisma.vendorReviewSuggestion.create({
      data: {
        runId,
        vendorId,
        recommendation: result.recommendation,
        confidence: new Prisma.Decimal(result.confidence.toFixed(3)),
        summary: result.summary,
        flags: result.flags,
        reasons: result.reasons,
        agentVersion: ADMIN_AGENT_VERSION,
      },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
