/** Listing classification — farmers markets vs local businesses and other USDA types. */

export const CLASSIFY_AI_VERSION = '1';

export type ListingCategory =
  | 'farmers_market'
  | 'on_farm_market'
  | 'csa'
  | 'food_hub'
  | 'agritourism'
  | 'farm_stand'
  | 'flea_market'
  | 'craft_market'
  | 'public_market'
  | 'local_business'
  | 'mixed'
  | 'unknown';

export type ClassificationSource = 'usda_directory' | 'heuristic' | 'ai' | 'existing';

export interface ClassificationInput {
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  description?: string | null;
  hoursSummary?: string | null;
  extraInfo?: string | null;
  websiteUrl?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  currentMarketType?: string | null;
}

export interface ClassificationResult {
  category: ListingCategory;
  confidence: 'high' | 'medium' | 'low';
  source: ClassificationSource;
  reasoning: string;
  /** Shown on shopper map/list when true (weekend/recurring markets). */
  isShopperMarket: boolean;
}

const USDA_DIRECTORY_CATEGORY: Record<string, ListingCategory> = {
  farmersmarket: 'farmers_market',
  csa: 'csa',
  onfarmmarket: 'on_farm_market',
  foodhub: 'food_hub',
  agritourism: 'agritourism',
};

const SHOPPER_MARKET_CATEGORIES = new Set<ListingCategory>([
  'farmers_market',
  'flea_market',
  'craft_market',
  'public_market',
  'mixed',
]);

const FARMERS_MARKET_NAME =
  /farmers?\s*market|farmers?\s*mkt|farm\s*market|green\s*market|producer\s*market|growers?\s*market/i;

const RECURRING_MARKET_NAME =
  /flea\s*market|craft\s*market|artisan\s*market|makers?\s*market|public\s*market|night\s*market/i;

const LOCAL_BUSINESS_NAME =
  /\b(restaurant|cafe|café|coffee\s*shop|coffee\s*house|bakery(?!\s*market)|pizzeria|pizza|grill|diner|bistro|tavern|bar\s*&\s*grill|brewery|brewpub|taproom|winery(?!\s*market)|distillery|grocery|supermarket|convenience|deli|delicatessen|butcher|meat\s*market|seafood\s*market|fish\s*market|pharmacy|drug\s*store|florist|nursery|garden\s*center|hardware\s*store|pet\s*store|salon|spa|barber|fitness|gym|hotel|motel|inn|lodging|bank|credit\s*union|insurance|realty|realtor|attorney|law\s*office|dentist|dental|clinic|medical|veterinary|vet\s*clinic|auto\s*repair|car\s*wash|gas\s*station|fuel|laundromat|dry\s*cleaner|antique\s*shop|thrift\s*store|consignment|boutique|jewelry|jeweler|optician|bookstore|toy\s*store|furniture\s*store|appliance|electronics|cellular|wireless|insurance|mortgage|church|ministry|school|academy|university|college|museum|library|theater|theatre|cinema|arena|stadium)\b/i;

const CHAIN_STORE =
  /\b(whole\s*foods|trader\s*joe|safeway|kroger|publix|aldi|costco|walmart|target|sam's\s*club|heb|meijer|wegmans|sprouts|fresh\s*market|food\s*lion|giant\s*eagle|stop\s*&\s*shop|shoprite|harris\s*teeter)\b/i;

const FARM_DIRECT =
  /\b(farm\s*stand|roadside\s*stand|u-?pick|pick\s*your\s*own|farm\s*store|farm\s*shop|honest\s*box|farm\s*gate)\b/i;

const ON_FARM =
  /\b(on-?farm|farm\s*store|farm\s*shop|farm\s*stand)\b/i;

const AGRITOURISM_NAME =
  /\b(corn\s*maze|pumpkin\s*patch|hayride|petting\s*zoo|farm\s*tour|agritourism|u-?pick)\b/i;

const CSA_NAME = /\b(csa|community\s*supported\s*agriculture|farm\s*share|subscription\s*box)\b/i;

const FOOD_HUB_NAME = /\b(food\s*hub|distribution\s*hub|wholesale|aggregat)/i;

export function parseUsdaDirectory(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const colon = externalId.indexOf(':');
  return colon > 0 ? externalId.slice(0, colon).toLowerCase() : 'farmersmarket';
}

export function isShopperMarketCategory(category: ListingCategory | string | null | undefined): boolean {
  if (!category) return true;
  return SHOPPER_MARKET_CATEGORIES.has(category as ListingCategory);
}

export function formatListingCategoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  const labels: Record<string, string> = {
    farmers_market: 'Farmers Market',
    on_farm_market: 'On-Farm Market',
    farm_stand: 'Farm Stand',
    csa: 'CSA',
    food_hub: 'Food Hub',
    agritourism: 'Agritourism',
    flea_market: 'Flea Market',
    craft_market: 'Craft Market',
    public_market: 'Public Market',
    local_business: 'Local Business',
    mixed: 'Mixed Market',
    unknown: 'Market',
  };
  return labels[category] ?? category.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function haystack(input: ClassificationInput): string {
  return [
    input.name,
    input.description,
    input.hoursSummary,
    input.extraInfo,
    input.address,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function fromUsdaDirectory(directory: string): ClassificationResult | null {
  const category = USDA_DIRECTORY_CATEGORY[directory];
  if (!category) return null;

  if (directory === 'farmersmarket') {
    return null;
  }

  return {
    category,
    confidence: 'high',
    source: 'usda_directory',
    reasoning: `USDA directory type: ${directory}`,
    isShopperMarket: isShopperMarketCategory(category),
  };
}

function classifyFarmersDirectoryListing(input: ClassificationInput): ClassificationResult | null {
  const name = input.name.trim();
  const hay = haystack(input);

  if (FARMERS_MARKET_NAME.test(name) || FARMERS_MARKET_NAME.test(hay)) {
    return {
      category: 'farmers_market',
      confidence: 'high',
      source: 'heuristic',
      reasoning: 'Name or description indicates a recurring farmers market.',
      isShopperMarket: true,
    };
  }

  if (RECURRING_MARKET_NAME.test(name)) {
    const category: ListingCategory = /flea/i.test(name)
      ? 'flea_market'
      : /craft|makers|artisan/i.test(name)
        ? 'craft_market'
        : 'public_market';
    return {
      category,
      confidence: 'high',
      source: 'heuristic',
      reasoning: 'Name indicates a recurring public market.',
      isShopperMarket: true,
    };
  }

  if (CSA_NAME.test(name) || CSA_NAME.test(hay)) {
    return {
      category: 'csa',
      confidence: 'high',
      source: 'heuristic',
      reasoning: 'CSA or farm-share program, not a weekend market.',
      isShopperMarket: false,
    };
  }

  if (FOOD_HUB_NAME.test(name) || FOOD_HUB_NAME.test(hay)) {
    return {
      category: 'food_hub',
      confidence: 'high',
      source: 'heuristic',
      reasoning: 'Wholesale or distribution hub, not a shopper farmers market.',
      isShopperMarket: false,
    };
  }

  if (AGRITOURISM_NAME.test(name) || AGRITOURISM_NAME.test(hay)) {
    return {
      category: 'agritourism',
      confidence: 'medium',
      source: 'heuristic',
      reasoning: 'Farm experience or attraction rather than a recurring market.',
      isShopperMarket: false,
    };
  }

  if (FARM_DIRECT.test(name) || ON_FARM.test(hay)) {
    return {
      category: /stand|roadside/i.test(name) ? 'farm_stand' : 'on_farm_market',
      confidence: 'medium',
      source: 'heuristic',
      reasoning: 'Direct farm sales location, not a multi-vendor weekend market.',
      isShopperMarket: false,
    };
  }

  if (LOCAL_BUSINESS_NAME.test(name) || CHAIN_STORE.test(name)) {
    const hasMarketContext = FARMERS_MARKET_NAME.test(name) || RECURRING_MARKET_NAME.test(name);
    if (!hasMarketContext) {
      return {
        category: 'local_business',
        confidence: CHAIN_STORE.test(name) ? 'high' : 'medium',
        source: 'heuristic',
        reasoning: 'Name matches a retail or service business, not a farmers market.',
        isShopperMarket: false,
      };
    }
  }

  if (/\bmarket\b/i.test(name) && !FARMERS_MARKET_NAME.test(name) && !RECURRING_MARKET_NAME.test(name)) {
    if (LOCAL_BUSINESS_NAME.test(name) || /\b(store|shop|co-?op)\b/i.test(name)) {
      return {
        category: 'local_business',
        confidence: 'medium',
        source: 'heuristic',
        reasoning: 'Uses "market" in the name but reads as a permanent retail business.',
        isShopperMarket: false,
      };
    }
  }

  return null;
}

/** Fast rule-based classification — no API calls. */
export function classifyListingWithHeuristics(input: ClassificationInput): ClassificationResult {
  const directory = parseUsdaDirectory(input.externalId);
  if (directory) {
    const fromDirectory = fromUsdaDirectory(directory);
    if (fromDirectory) return fromDirectory;

    if (directory === 'farmersmarket') {
      const farmersResult = classifyFarmersDirectoryListing(input);
      if (farmersResult) return farmersResult;
    }
  }

  if (input.currentMarketType && input.currentMarketType !== 'unknown') {
    const category = input.currentMarketType as ListingCategory;
    return {
      category,
      confidence: 'low',
      source: 'existing',
      reasoning: 'No strong heuristic match; kept existing market type.',
      isShopperMarket: isShopperMarketCategory(category),
    };
  }

  return {
    category: 'unknown',
    confidence: 'low',
    source: 'heuristic',
    reasoning: 'Could not determine listing type from name and metadata.',
    isShopperMarket: true,
  };
}

export interface AiClassificationPayload {
  category: ListingCategory;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  isShopperMarket: boolean;
}

const VALID_AI_CATEGORIES = new Set<ListingCategory>([
  'farmers_market',
  'on_farm_market',
  'csa',
  'food_hub',
  'agritourism',
  'farm_stand',
  'flea_market',
  'craft_market',
  'public_market',
  'local_business',
  'mixed',
  'unknown',
]);

export function parseAiClassificationPayload(raw: unknown): AiClassificationPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<AiClassificationPayload>;
  if (!parsed.category || !VALID_AI_CATEGORIES.has(parsed.category as ListingCategory)) return null;

  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'medium';

  return {
    category: parsed.category as ListingCategory,
    confidence,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : 'AI classification',
    isShopperMarket:
      typeof parsed.isShopperMarket === 'boolean'
        ? parsed.isShopperMarket
        : isShopperMarketCategory(parsed.category),
  };
}
