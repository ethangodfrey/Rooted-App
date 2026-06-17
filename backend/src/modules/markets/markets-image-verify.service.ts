import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { DiscoveredMarket } from './markets.types';

export interface MarketImageVerification {
  approved: boolean;
  confidence: number;
  reason: string;
}

@Injectable()
export class MarketsImageVerifyService {
  private readonly logger = new Logger(MarketsImageVerifyService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    const flag =
      this.config.get<string>('MARKETS_IMAGE_VISION_ENABLED', 'true').toLowerCase() === 'true';
    return flag && Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  minConfidence(): number {
    const configured = Number(this.config.get<string>('MARKETS_IMAGE_VISION_MIN_CONFIDENCE', '0.85'));
    return Number.isFinite(configured) ? Math.min(Math.max(configured, 0.5), 1) : 0.85;
  }

  async verify(market: DiscoveredMarket, imageUrl: string): Promise<MarketImageVerification> {
    if (!this.enabled) {
      return {
        approved: false,
        confidence: 0,
        reason: 'Vision verification disabled or OpenAI key missing.',
      };
    }

    try {
      const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
      const model = this.config.get<string>('MARKETS_IMAGE_VISION_MODEL', 'gpt-4o-mini');

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
              content: `You verify farmers market / public market event photos for a local marketplace app.
Return JSON only:
{
  "approved": boolean,
  "confidence": number between 0 and 1,
  "reason": "short explanation"
}
Approve ONLY when the image is a real photograph that plausibly shows the named market or a very similar outdoor farmers/public market in the named city/area.
Reject: city skylines, maps, logos, cartoons, unrelated buildings, food product close-ups with no market context, people-only portraits, stock photos, screenshots, wrong city landmarks, indoor unrelated scenes.
When unsure, reject (approved=false).`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    marketName: market.name,
                    city: market.city,
                    state: market.state,
                    address: market.address,
                  }),
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'low' },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(text) as Partial<MarketImageVerification>;

      const confidence =
        typeof parsed.confidence === 'number'
          ? Math.min(Math.max(parsed.confidence, 0), 1)
          : 0;
      const approved = Boolean(parsed.approved) && confidence >= this.minConfidence();

      return {
        approved,
        confidence,
        reason: parsed.reason?.trim() || (approved ? 'Vision approved.' : 'Vision rejected.'),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Vision verify failed for ${market.name}: ${message}`);
      return {
        approved: false,
        confidence: 0,
        reason: `Vision error: ${message}`,
      };
    }
  }
}
