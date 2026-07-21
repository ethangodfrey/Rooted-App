export type MixBucket =
  | 'Produce'
  | 'Baked Goods'
  | 'Artisan Crafts'
  | 'Coffee & Drink'
  | 'Prepared Foods'
  | 'Other';

export const MIX_BUCKETS: MixBucket[] = [
  'Produce',
  'Baked Goods',
  'Artisan Crafts',
  'Coffee & Drink',
  'Prepared Foods',
  'Other',
];

export const MIX_BUCKET_COLORS: Record<MixBucket, string> = {
  Produce: '#F97316',
  'Baked Goods': '#FBBF24',
  'Artisan Crafts': '#EA580C',
  'Coffee & Drink': '#D97706',
  'Prepared Foods': '#FB923C',
  Other: '#F59E0B',
};

export interface MixSlice {
  bucket: MixBucket;
  count: number;
  fill: string;
}

export interface MixRecommendation {
  id: string;
  severity: 'warn' | 'info' | 'ok';
  title: string;
  body: string;
  targetBucket?: MixBucket;
}

export interface InviteCandidate {
  id: string;
  businessName: string;
  category: string | null;
  bucket: MixBucket;
  city: string | null;
  state: string | null;
}

const BAKED = /bak|cookie|pastr|bread|cake|donut|doughnut|pie|confection/i;
const PRODUCE = /produce|farm|vegetable|fruit|herb|flower|plant|grower|agri/i;
const COFFEE = /coffee|tea|cocoa|beverage|drink|juice|soda|espresso/i;
const PREPARED = /prepared|meal|ready|hot food|food truck|savory|kitchen/i;
const CRAFT =
  /craft|artisan|art|print|jewelry|apparel|home|decor|candle|soap|vintage|thrift|handmade|wellness|pet/i;

export function normalizeMixBucket(
  category: string | null | undefined,
  productSummary?: string | null,
): MixBucket {
  const text = `${category ?? ''} ${productSummary ?? ''}`.trim();
  if (!text) return 'Other';
  if (BAKED.test(text) || /baked goods/i.test(text)) return 'Baked Goods';
  if (PRODUCE.test(text) || /plants/i.test(text)) return 'Produce';
  if (COFFEE.test(text) || /food & drink/i.test(text)) return 'Coffee & Drink';
  if (PREPARED.test(text)) return 'Prepared Foods';
  if (CRAFT.test(text)) return 'Artisan Crafts';
  return 'Other';
}

export function buildMixSlices(
  vendors: Array<{ category?: string | null; product_summary?: string | null }>,
): MixSlice[] {
  const counts = new Map<MixBucket, number>();
  for (const bucket of MIX_BUCKETS) counts.set(bucket, 0);
  for (const vendor of vendors) {
    const bucket = normalizeMixBucket(vendor.category, vendor.product_summary);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return MIX_BUCKETS.map((bucket) => ({
    bucket,
    count: counts.get(bucket) ?? 0,
    fill: MIX_BUCKET_COLORS[bucket],
  })).filter((slice) => slice.count > 0);
}

function nextWeekdayLabel(from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function buildMixRecommendations(
  slices: MixSlice[],
  totalVendors: number,
  eventName?: string | null,
): MixRecommendation[] {
  const recs: MixRecommendation[] = [];
  if (totalVendors === 0) {
    return [
      {
        id: 'empty',
        severity: 'info',
        title: 'No roster yet',
        body: 'Approve vendors for an upcoming market to unlock mix balance insights.',
      },
    ];
  }

  const dayLabel = nextWeekdayLabel();
  const baked = slices.find((s) => s.bucket === 'Baked Goods')?.count ?? 0;
  const produce = slices.find((s) => s.bucket === 'Produce')?.count ?? 0;
  const crafts = slices.find((s) => s.bucket === 'Artisan Crafts')?.count ?? 0;
  const coffee = slices.find((s) => s.bucket === 'Coffee & Drink')?.count ?? 0;

  if (baked >= 4) {
    recs.push({
      id: 'cookie-density',
      severity: 'warn',
      title: '⚠️ High Cookie Density',
      body: `${baked} bakeries active next ${dayLabel}${
        eventName ? ` at ${eventName}` : ''
      }. Auto-invite local farms to balance?`,
      targetBucket: 'Produce',
    });
  }
  if (produce === 0 && totalVendors >= 3) {
    recs.push({
      id: 'missing-produce',
      severity: 'warn',
      title: '⚠️ Produce gap',
      body: 'No produce vendors on the roster. Invite nearby farms to restore freshness balance.',
      targetBucket: 'Produce',
    });
  }
  if (crafts >= 5 && coffee === 0) {
    recs.push({
      id: 'craft-heavy',
      severity: 'warn',
      title: '⚠️ Craft-heavy mix',
      body: `${crafts} artisan booths and zero coffee/drink — invite a beverage maker for dwell time.`,
      targetBucket: 'Coffee & Drink',
    });
  }

  const dominant = [...slices].sort((a, b) => b.count - a.count)[0];
  if (dominant && totalVendors >= 6 && dominant.count / totalVendors >= 0.45) {
    recs.push({
      id: 'dominant-category',
      severity: 'warn',
      title: `⚠️ ${dominant.bucket} dominates`,
      body: `${dominant.count} of ${totalVendors} booths are ${dominant.bucket}. Diversify with under-served categories.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'balanced',
      severity: 'ok',
      title: '✓ Mix looks balanced',
      body: 'Category distribution is within healthy ranges for this market size.',
    });
  }
  return recs;
}

export function pickInviteCandidates(
  allApproved: Array<{
    id: string;
    business_name: string | null;
    category: string | null;
    product_summary: string | null;
    sell_city: string | null;
    sell_state: string | null;
  }>,
  attendingIds: Set<string>,
  neededBuckets: MixBucket[],
  limit = 12,
): InviteCandidate[] {
  const preferred = neededBuckets.length > 0 ? neededBuckets : (['Produce', 'Coffee & Drink'] as MixBucket[]);
  const out: InviteCandidate[] = [];
  for (const vendor of allApproved) {
    if (attendingIds.has(vendor.id)) continue;
    const bucket = normalizeMixBucket(vendor.category, vendor.product_summary);
    if (!preferred.includes(bucket) && preferred.length > 0) continue;
    out.push({
      id: vendor.id,
      businessName: vendor.business_name?.trim() || 'Untitled vendor',
      category: vendor.category,
      bucket,
      city: vendor.sell_city,
      state: vendor.sell_state,
    });
    if (out.length >= limit) break;
  }
  if (out.length < Math.min(6, limit)) {
    for (const vendor of allApproved) {
      if (attendingIds.has(vendor.id)) continue;
      if (out.some((c) => c.id === vendor.id)) continue;
      const bucket = normalizeMixBucket(vendor.category, vendor.product_summary);
      out.push({
        id: vendor.id,
        businessName: vendor.business_name?.trim() || 'Untitled vendor',
        category: vendor.category,
        bucket,
        city: vendor.sell_city,
        state: vendor.sell_state,
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function neededBucketsFromRecommendations(recs: MixRecommendation[]): MixBucket[] {
  return [...new Set(recs.map((r) => r.targetBucket).filter((b): b is MixBucket => Boolean(b)))];
}
