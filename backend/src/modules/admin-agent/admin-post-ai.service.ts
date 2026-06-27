import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PostModerationCategory,
  PostModerationFeedbackExample,
  PostModerationProfile,
  PostModerationResult,
} from './admin-post.types';

const VALID_RECOMMENDATIONS = new Set(['approve', 'flag', 'remove']);
const VALID_CATEGORIES = new Set([
  'spam',
  'harassment',
  'explicit',
  'violence',
  'illegal',
  'misleading',
  'off_topic',
  'none',
]);

@Injectable()
export class AdminPostAiService {
  private readonly logger = new Logger(AdminPostAiService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  moderateRules(post: PostModerationProfile): PostModerationResult {
    const caption = post.caption.trim().toLowerCase();
    const flags: string[] = [];
    const reasons: string[] = [];
    const categories: PostModerationCategory[] = [];

    const blockedTerms = ['porn', 'xxx', 'nude', 'onlyfans', 'crypto scam', 'get rich quick'];
    const hit = blockedTerms.find((term) => caption.includes(term));
    if (hit) {
      flags.push('blocked_term');
      reasons.push(`Caption contains a blocked term pattern (${hit}).`);
      categories.push('explicit');
    }

    if (!caption) {
      flags.push('empty_caption');
      reasons.push('Post has no caption.');
    }

    if (flags.length > 0) {
      return {
        recommendation: 'flag',
        confidence: 0.75,
        summary: 'Caption triggered basic moderation rules — needs human review.',
        categories: categories.length ? categories : ['spam'],
        flags,
        reasons,
      };
    }

    return {
      recommendation: 'approve',
      confidence: 0.7,
      summary: 'No issues detected by rules — looks like a normal vendor update.',
      categories: ['none'],
      flags: ['rules_clear'],
      reasons: ['Caption appears appropriate for a local marketplace feed.'],
    };
  }

  async moderate(
    post: PostModerationProfile,
    feedbackExamples: PostModerationFeedbackExample[] = [],
  ): Promise<PostModerationResult> {
    const rules = this.moderateRules(post);
    if (!this.enabled) return rules;

    try {
      const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
      const model = this.config.get<string>('ADMIN_POST_AI_MODEL', 'gpt-4o-mini');

      const feedbackBlock =
        feedbackExamples.length > 0
          ? `\nPast admin moderation decisions (align with accepted, avoid overridden mistakes):\n${JSON.stringify(feedbackExamples, null, 2)}`
          : '';

      const userText = JSON.stringify({
        vendorName: post.vendorName,
        postType: post.postType,
        caption: post.caption,
        mediaType: post.mediaType,
        hasMedia: Boolean(post.mediaUrl),
        isVideo: post.mediaType === 'video',
        rulesBaseline: rules,
        pastAdminDecisions: feedbackExamples,
      });

      const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: userText }];

      const imageUrl = this.resolveVisionUrl(post);
      if (imageUrl) {
        userContent.push({
          type: 'image_url',
          image_url: { url: imageUrl, detail: 'low' },
        });
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a content moderator for Vendorly, a local food marketplace feed.
Vendors post promotions, product launches, restocks, and market-day updates (text, photos, short videos).

Return JSON only:
{
  "recommendation": "approve|flag|remove",
  "confidence": 0.0-1.0,
  "summary": "1-2 sentences for the human admin",
  "categories": ["spam|harassment|explicit|violence|illegal|misleading|off_topic|none"],
  "flags": ["short_snake_case_flags"],
  "reasons": ["why"]
}

Guidelines:
- "approve" for normal vendor marketing, product photos, market announcements
- "flag" when uncertain, borderline, or video needs human watch (you only see caption${imageUrl ? ' + one image/thumbnail' : ''})
- "remove" only for clear violations: explicit sexual content, hate/harassment, scams, illegal goods, graphic violence
- marketplace-appropriate food/craft/product imagery is fine
- be strict on spam, MLM, unrelated adult content, and misleading health claims${feedbackBlock}`,
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(text) as Partial<PostModerationResult> & {
        categories?: string[];
      };

      const recommendation = VALID_RECOMMENDATIONS.has(parsed.recommendation ?? '')
        ? (parsed.recommendation as PostModerationResult['recommendation'])
        : rules.recommendation;

      const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? rules.confidence)));

      const categories = (Array.isArray(parsed.categories) ? parsed.categories : rules.categories)
        .map((c) => (VALID_CATEGORIES.has(c) ? c : 'none'))
        .filter((c, i, arr) => arr.indexOf(c) === i) as PostModerationCategory[];

      return {
        recommendation,
        confidence: Number.isFinite(confidence) ? confidence : rules.confidence,
        summary: parsed.summary?.trim() || rules.summary,
        categories: categories.length ? categories : ['none'],
        flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : rules.flags,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : rules.reasons,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI post moderation failed for ${post.id}: ${message}`);
      return rules;
    }
  }

  private resolveVisionUrl(post: PostModerationProfile): string | null {
    if (post.mediaType === 'video') {
      return post.videoThumbnailUrl?.trim() || null;
    }
    return post.mediaUrl?.trim() || null;
  }
}
