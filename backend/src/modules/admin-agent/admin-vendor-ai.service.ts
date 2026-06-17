import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  VendorApplicationProfile,
  VendorReviewFeedbackExample,
  VendorReviewResult,
} from './admin-agent.types';

const VALID_RECOMMENDATIONS = new Set(['approve', 'reject', 'needs_review']);

@Injectable()
export class AdminVendorAiService {
  private readonly logger = new Logger(AdminVendorAiService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  reviewRules(vendor: VendorApplicationProfile): VendorReviewResult {
    const flags: string[] = [];
    const reasons: string[] = [];

    const hasProduct = Boolean(vendor.productSummary?.trim() && vendor.category?.trim());
    const hasLocation = Boolean(vendor.sellCity?.trim() && vendor.sellState?.trim());
    const hasChannels = vendor.sellingChannels.length > 0;
    const hasLink = Boolean(vendor.instagramUrl?.trim() || vendor.websiteUrl?.trim());
    const submitted = Boolean(vendor.applicationSubmittedAt);

    if (!hasProduct) {
      flags.push('missing_product_info');
      reasons.push('Product summary or category is missing.');
    }
    if (!hasLocation) {
      flags.push('missing_location');
      reasons.push('Selling city or state is missing.');
    }
    if (!hasChannels) {
      flags.push('missing_channels');
      reasons.push('No selling channels listed.');
    }
    if (!hasLink) {
      flags.push('missing_verification_link');
      reasons.push('No Instagram or website link to spot-check the business.');
    }
    if (!submitted) {
      flags.push('incomplete_application');
      reasons.push('Application has not been formally submitted.');
    }

    const summaryParts = [
      vendor.businessName ?? 'Unnamed vendor',
      vendor.category,
      vendor.sellCity && vendor.sellState ? `${vendor.sellCity}, ${vendor.sellState}` : null,
    ].filter(Boolean);

    if (flags.length === 0) {
      return {
        recommendation: 'approve',
        confidence: 0.85,
        summary: `${summaryParts.join(' · ')} — application looks complete for a local market vendor.`,
        flags: ['rules_complete'],
        reasons: [
          'All required application fields are present.',
          'Human admin should still spot-check the Instagram or website link.',
        ],
      };
    }

    if (!submitted || flags.length >= 3) {
      return {
        recommendation: 'needs_review',
        confidence: 0.7,
        summary: `${summaryParts.join(' · ')} — application needs admin attention before approval.`,
        flags,
        reasons,
      };
    }

    return {
      recommendation: 'needs_review',
      confidence: 0.6,
      summary: `${summaryParts.join(' · ')} — minor gaps; review before approving.`,
      flags,
      reasons,
    };
  }

  async review(
    vendor: VendorApplicationProfile,
    feedbackExamples: VendorReviewFeedbackExample[] = [],
  ): Promise<VendorReviewResult> {
    const rules = this.reviewRules(vendor);
    if (!this.enabled) return rules;

    try {
      const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
      const model = this.config.get<string>('ADMIN_VENDOR_AI_MODEL', 'gpt-4o-mini');

      const feedbackBlock =
        feedbackExamples.length > 0
          ? `

Past admin decisions (learn from these — align with accepted patterns, avoid repeating overridden mistakes):
${JSON.stringify(feedbackExamples, null, 2)}`
          : '';

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant helping Rooted marketplace admins review vendor applications.
Rooted is a local makers/artisans marketplace for farmers markets, craft fairs, flea markets, and pop-ups.
Vendors sell handmade goods, food, art, plants, vintage, wellness products, etc. — not big-box retail or restaurants.

Return JSON only:
{
  "recommendation": "approve|reject|needs_review",
  "confidence": 0.0-1.0,
  "summary": "1-2 sentence plain-English summary for the human admin",
  "flags": ["short_snake_case_flags"],
  "reasons": ["bullet reasons supporting the recommendation"]
}

Guidelines:
- recommend "approve" only when the application looks like a genuine small/local vendor with complete info
- recommend "reject" only for clear spam, scams, empty shells, or businesses that don't fit Rooted (chains, MLM, unrelated services)
- default to "needs_review" when uncertain or info is thin
- never auto-trust links; note if Instagram/website should be spot-checked
- be fair to new/home-based makers with thin online presence
- when past admin feedback is provided, treat "accepted" outcomes as patterns to follow and "overridden" as cases where the human disagreed — adjust accordingly${feedbackBlock}`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                businessName: vendor.businessName,
                businessDescription: vendor.businessDescription,
                category: vendor.category,
                productSummary: vendor.productSummary,
                sellCity: vendor.sellCity,
                sellState: vendor.sellState,
                sellingChannels: vendor.sellingChannels,
                primaryMarket: vendor.primaryMarket,
                instagramUrl: vendor.instagramUrl,
                websiteUrl: vendor.websiteUrl,
                applicationSubmittedAt: vendor.applicationSubmittedAt?.toISOString() ?? null,
                applicantEmail: vendor.userEmail,
                rulesBaseline: rules,
                pastAdminDecisions: feedbackExamples,
              }),
            },
          ],
        }),
      });

      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(text) as Partial<VendorReviewResult>;

      const recommendation = VALID_RECOMMENDATIONS.has(parsed.recommendation ?? '')
        ? (parsed.recommendation as VendorReviewResult['recommendation'])
        : rules.recommendation;

      const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? rules.confidence)));

      return {
        recommendation,
        confidence: Number.isFinite(confidence) ? confidence : rules.confidence,
        summary: parsed.summary?.trim() || rules.summary,
        flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : rules.flags,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : rules.reasons,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI vendor review failed for ${vendor.id}: ${message}`);
      return rules;
    }
  }
}
