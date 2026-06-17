import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { inferMarketType, parseOsmOpeningHours } from './market-schedule.util';
import { clampHour, normalizeDays, sanitizeMarketHours } from './schedule-hour.util';
import { timezoneAbbreviation, timezoneForState } from './us-state-timezones';
import { normalizeWebsiteUrl } from './website.util';
import type { DiscoveredMarket, EnrichedMarketProfile, MarketType } from './markets.types';

const VALID_TYPES: MarketType[] = [
  'farmers_market',
  'flea_market',
  'public_market',
  'craft_market',
  'mixed',
  'unknown',
];

const VALID_DAYS = new Set([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

@Injectable()
export class MarketsAiService {
  private readonly logger = new Logger(MarketsAiService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  enrichRules(market: DiscoveredMarket): EnrichedMarketProfile {
    return this.enrichWithRules(market);
  }

  async enrich(market: DiscoveredMarket): Promise<EnrichedMarketProfile> {
    const rules = this.enrichWithRules(market);
    if (!this.enabled) return rules;

    try {
      const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
      const model = this.config.get<string>('MARKETS_AI_MODEL', 'gpt-4o-mini');
      const timezone = timezoneForState(market.state);
      const tzLabel = timezoneAbbreviation(timezone);

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a US farmers market historian and Rooted app local food guide writer.
Rooted is a shopper app — write practical, specific, trustworthy copy that helps someone plan a visit.

Return JSON only:
{
  "description": "2-3 vivid sentences (400-600 chars) about atmosphere and what makes this market worth visiting",
  "marketHistory": "3-5 sentences on origins, founding year if known, growth, community role — or null if truly unknown",
  "marketType": "farmers_market|flea_market|public_market|craft_market|mixed|unknown",
  "hoursSummary": "full schedule in LOCAL time with timezone label e.g. Saturdays 8:00 AM – 1:00 PM CT, May–October",
  "runsOnDays": ["saturday"],
  "seasonalSchedule": "e.g. May–October or year-round",
  "typicalDayOfWeek": "primary day for next occurrence",
  "typicalStartHour": 8,
  "typicalEndHour": 13,
  "parkingInfo": "string or null",
  "admissionInfo": "e.g. Free admission.",
  "vendorTypes": "comma-separated vendor categories (produce, baked goods, flowers, etc.) or null",
  "featuredVendorCategories": ["seasonal produce", "artisan bread", "local honey"],
  "paymentMethods": "cash, cards, SNAP/EBT, etc. or null",
  "whatToLookFor": "2-4 sentences on signature items, seasonal peaks, and local specialties a shopper should hunt for at THIS market/region",
  "marketHighlights": "1-3 sentences on recent community news, expansions, awards, or typical seasonal happenings. If no verified news, describe typical seasonal highlights and prefix with 'Typical season:'",
  "shopperTips": ["arrive early for best selection", "bring reusable bags", "check organizer site for holiday closures"],
  "extraInfo": "pet policy, accessibility, rain policy, etc. or null",
  "websiteUrl": "url or null",
  "organizerName": "string or null",
  "wikipediaTitle": "exact English Wikipedia article title if this market has a page, else null"
}

Rules:
- All times are LOCAL wall-clock (${tzLabel}).
- featuredVendorCategories: 4-8 category labels only — NEVER invent specific vendor business names.
- shopperTips: 3-5 short actionable bullets for visitors.
- whatToLookFor and marketHighlights must be specific to this city/region when possible.
- For famous markets use real historical facts. For generic markets, describe honest regional patterns and say "confirm with organizer".
- USDA catalog listings are often sparse — use location, name, and website to infer responsibly.
- Prefer OSM opening_hours when provided.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                name: market.name,
                city: market.city,
                state: market.state,
                zipcode: market.zipcode,
                timezone,
                address: market.address,
                openingHours: market.openingHours,
                website: market.website,
                organizerName: market.organizerName,
                tags: market.rawTags,
                usdaListingId:
                  market.externalSource === 'usda' ? market.externalId : null,
                dataSource: market.externalSource,
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
      const parsed = JSON.parse(text) as Partial<EnrichedMarketProfile> & {
        marketType?: string;
        marketHistory?: string | null;
        runsOnDays?: string[];
        typicalDayOfWeek?: string;
        typicalStartHour?: number;
        typicalEndHour?: number;
        featuredVendorCategories?: string[];
        shopperTips?: string[];
      };

      const featuredVendorCategories = this.normalizeStringList(parsed.featuredVendorCategories);
      const shopperTips = this.normalizeStringList(parsed.shopperTips);

      const marketType = VALID_TYPES.includes(parsed.marketType as MarketType)
        ? (parsed.marketType as MarketType)
        : rules.marketType;

      const runsOnDays = parsed.runsOnDays?.length
        ? normalizeDays(parsed.runsOnDays)
        : rules.runsOnDays;
      const typicalDay = parsed.typicalDayOfWeek?.toLowerCase() || runsOnDays[0] || rules.typicalDayOfWeek;
      const sanitized = sanitizeMarketHours(
        clampHour(parsed.typicalStartHour, rules.typicalStartHour),
        clampHour(parsed.typicalEndHour, rules.typicalEndHour),
        marketType,
      );

      const extraParts = [
        parsed.seasonalSchedule ? `Season: ${parsed.seasonalSchedule}` : null,
        parsed.paymentMethods ? `Payment: ${parsed.paymentMethods}` : null,
        parsed.extraInfo?.trim() || null,
      ].filter(Boolean);

      return {
        description: parsed.description?.trim() || rules.description,
        marketHistory: parsed.marketHistory?.trim() || rules.marketHistory,
        marketType,
        hoursSummary: parsed.hoursSummary?.trim() || rules.hoursSummary,
        runsOnDays,
        seasonalSchedule: parsed.seasonalSchedule?.trim() || rules.seasonalSchedule,
        parkingInfo: parsed.parkingInfo?.trim() || rules.parkingInfo,
        admissionInfo: parsed.admissionInfo?.trim() || rules.admissionInfo,
        vendorTypes: parsed.vendorTypes?.trim() || rules.vendorTypes,
        paymentMethods: parsed.paymentMethods?.trim() || rules.paymentMethods,
        extraInfo: extraParts.length > 0 ? extraParts.join(' · ') : rules.extraInfo,
        whatToLookFor: parsed.whatToLookFor?.trim() || rules.whatToLookFor,
        marketHighlights: parsed.marketHighlights?.trim() || rules.marketHighlights,
        featuredVendorCategories:
          featuredVendorCategories.length > 0
            ? featuredVendorCategories
            : rules.featuredVendorCategories,
        shopperTips: shopperTips.length > 0 ? shopperTips : rules.shopperTips,
        websiteUrl: normalizeWebsiteUrl(
          parsed.websiteUrl?.trim() || market.website || rules.websiteUrl,
        ),
        organizerName: parsed.organizerName?.trim() || market.organizerName || rules.organizerName,
        wikipediaTitle: parsed.wikipediaTitle?.trim() || null,
        bannerUrl: null,
        imageSource: null,
        timezone,
        typicalDayOfWeek: typicalDay,
        typicalStartHour: sanitized.startHour,
        typicalEndHour: sanitized.endHour,
        enrichedBy: 'ai',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI enrich skipped for ${market.name}: ${message}`);
      return rules;
    }
  }

  private normalizeDays(days: string[] | undefined): string[] | null {
    if (!days?.length) return null;
    const normalized = days
      .map((d) => d.toLowerCase().trim())
      .filter((d) => VALID_DAYS.has(d));
    return normalized.length > 0 ? [...new Set(normalized)] : null;
  }

  private normalizeStringList(values: string[] | undefined): string[] {
    if (!values?.length) return [];
    return values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, 8);
  }

  private defaultFeaturedCategories(market: DiscoveredMarket): string[] {
    const name = market.name.toLowerCase();
    const categories = ['seasonal produce', 'local baked goods'];
    if (name.includes('craft') || name.includes('artisan')) {
      categories.push('handmade crafts');
    }
    if (name.includes('flea')) {
      categories.push('vintage finds', 'antiques');
    }
    categories.push('flowers & plants');
    return categories;
  }

  private defaultShopperTips(market: DiscoveredMarket): string[] {
    return [
      'Arrive early for the best selection of produce and baked goods',
      'Bring reusable bags and small bills if card acceptance is uncertain',
      `Check ${market.website ? 'the market website' : 'with the organizer'} for weather closures and holiday schedules`,
    ];
  }

  private enrichWithRules(market: DiscoveredMarket): EnrichedMarketProfile {
    const hours = parseOsmOpeningHours(market.openingHours);
    const marketType = inferMarketType(market.name, market.rawTags) as MarketType;
    const day = hours?.dayOfWeek ?? 'saturday';
    const timezone = timezoneForState(market.state);
    const tzLabel = timezoneAbbreviation(timezone);
    const startHour = hours?.startHour ?? 8;
    const endHour = hours?.endHour ?? 13;

    return {
      description:
        market.description ||
        `${market.name} brings together local growers and makers in ${market.city}, ${market.state}. ` +
          `Browse seasonal produce, baked goods, and artisan products in a community gathering space. ` +
          `Hours and vendors may vary — confirm with the organizer.`,
      marketHistory: null,
      marketType: VALID_TYPES.includes(marketType) ? marketType : 'unknown',
      hoursSummary:
        hours?.summary ??
        `Typically ${day.charAt(0).toUpperCase() + day.slice(1)}s ${startHour}:00 – ${endHour}:00 ${tzLabel} — confirm with organizer.`,
      runsOnDays: [day],
      seasonalSchedule: null,
      parkingInfo: market.parkingInfo,
      admissionInfo: market.admissionInfo || 'Free admission.',
      vendorTypes: null,
      paymentMethods: null,
      extraInfo: null,
      whatToLookFor:
        `Look for peak-season produce from ${market.city}-area farms, fresh baked goods, and small-batch pantry items. ` +
        `Regional specialties vary by month — ask vendors what is best this week.`,
      marketHighlights:
        `Typical season: community gatherings, live music or kids activities are common at markets in ${market.city}. ` +
        `Confirm current happenings with the organizer.`,
      featuredVendorCategories: this.defaultFeaturedCategories(market),
      shopperTips: this.defaultShopperTips(market),
      websiteUrl: normalizeWebsiteUrl(market.website),
      organizerName: market.organizerName,
      wikipediaTitle: null,
      bannerUrl: null,
      imageSource: null,
      timezone,
      typicalDayOfWeek: day,
      typicalStartHour: startHour,
      typicalEndHour: endHour,
      enrichedBy: 'rules',
    };
  }
}
