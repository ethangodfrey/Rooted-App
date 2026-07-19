/**
 * Spatial query profiling helpers for nationwide bounding-box lookups.
 * Uppercase text-only diagnostics — no emoji.
 */

export type GeoExplainNode = {
  'Node Type'?: string;
  'Index Name'?: string;
  'Relation Name'?: string;
  Plans?: GeoExplainNode[];
  Plan?: GeoExplainNode;
};

export type GeoIndexProfile = {
  INDEX_MATCHED: boolean;
  TABLE_SCAN: boolean;
  INDEX_NAMES: string[];
  NODE_TYPES: string[];
  OPTIMAL: boolean;
};

const GEO_INDEX_HINTS = [
  'markets_lat_lng_idx',
  'markets_state_city_idx',
  'markets_state_idx',
  'markets_city_idx',
  'markets_directory_slug_idx',
] as const;

function walkPlan(node: GeoExplainNode | undefined, acc: GeoIndexProfile): void {
  if (!node) return;
  const nodeType = node['Node Type'] ?? '';
  if (nodeType) acc.NODE_TYPES.push(nodeType);

  const indexName = node['Index Name'];
  if (indexName) {
    acc.INDEX_NAMES.push(indexName);
    if (
      GEO_INDEX_HINTS.some((hint) => indexName.includes(hint)) ||
      /lat|lng|geo|market/i.test(indexName)
    ) {
      acc.INDEX_MATCHED = true;
    }
  }

  if (/Index Scan|Bitmap Index Scan|Index Only Scan/i.test(nodeType)) {
    acc.INDEX_MATCHED = true;
  }
  if (/Seq Scan/i.test(nodeType) && (node['Relation Name'] ?? '') === 'markets') {
    acc.TABLE_SCAN = true;
  }

  for (const child of node.Plans ?? []) {
    walkPlan(child, acc);
  }
  if (node.Plan) {
    walkPlan(node.Plan, acc);
  }
}

/**
 * Parse Postgres EXPLAIN (FORMAT JSON) output into an index-utilization profile.
 */
export function analyzeGeoExplainJson(explainRows: unknown): GeoIndexProfile {
  const profile: GeoIndexProfile = {
    INDEX_MATCHED: false,
    TABLE_SCAN: false,
    INDEX_NAMES: [],
    NODE_TYPES: [],
    OPTIMAL: false,
  };

  const roots = Array.isArray(explainRows) ? explainRows : [explainRows];
  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const row = root as { Plan?: GeoExplainNode } & GeoExplainNode;
    walkPlan(row.Plan ?? row, profile);
  }

  // Optimal when an index path was used and markets avoided a plain seq scan,
  // or when the planner chose a tiny seq scan with no markets relation scan.
  profile.OPTIMAL = profile.INDEX_MATCHED && !profile.TABLE_SCAN;
  return profile;
}

export function formatGeoProfileLogs(profile: GeoIndexProfile): string[] {
  const lines: string[] = [];
  if (profile.INDEX_MATCHED) {
    lines.push(
      `GEO_INDEX_MATCHED INDEXES=${profile.INDEX_NAMES.join(',') || 'PLANNER_INDEX_PATH'}`,
    );
  } else {
    lines.push('GEO_INDEX_MISS NO_INDEX_PATH');
  }

  if (!profile.TABLE_SCAN) {
    lines.push('TABLE_SCAN_AVOIDED RELATION=markets');
  } else {
    lines.push('TABLE_SCAN_DETECTED RELATION=markets');
  }

  if (profile.OPTIMAL) {
    lines.push('QUERY_EXECUTION_OPTIMAL');
  } else {
    lines.push('QUERY_EXECUTION_SUBOPTIMAL');
  }
  return lines;
}

/** True when GEO_QUERY_PROFILE is enabled (default on in non-production). */
export function isGeoQueryProfileEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = (env.GEO_QUERY_PROFILE ?? '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  return (env.NODE_ENV ?? 'development') !== 'production';
}

export const EXPECTED_MARKETS_GEO_INDEXES = GEO_INDEX_HINTS;
