import {
  EXPECTED_MARKETS_GEO_INDEXES,
  analyzeGeoExplainJson,
  formatGeoProfileLogs,
  isGeoQueryProfileEnabled,
} from './geo-query-profile.util';

describe('GEO QUERY PROFILE', () => {
  it('GEO_INDEX_MATCHED when planner uses markets_lat_lng_idx', () => {
    const explain = [
      {
        Plan: {
          'Node Type': 'Limit',
          Plans: [
            {
              'Node Type': 'Index Scan',
              'Index Name': 'markets_lat_lng_idx',
              'Relation Name': 'markets',
            },
          ],
        },
      },
    ];

    const profile = analyzeGeoExplainJson(explain);
    expect(profile.INDEX_MATCHED).toBe(true);
    expect(profile.TABLE_SCAN).toBe(false);
    expect(profile.OPTIMAL).toBe(true);

    const logs = formatGeoProfileLogs(profile);
    expect(logs).toContain(
      'GEO_INDEX_MATCHED INDEXES=markets_lat_lng_idx',
    );
    expect(logs).toContain('TABLE_SCAN_AVOIDED RELATION=markets');
    expect(logs).toContain('QUERY_EXECUTION_OPTIMAL');
  });

  it('detects sequential scan on markets as suboptimal', () => {
    const explain = [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'markets',
        },
      },
    ];

    const profile = analyzeGeoExplainJson(explain);
    expect(profile.TABLE_SCAN).toBe(true);
    expect(profile.OPTIMAL).toBe(false);
    expect(formatGeoProfileLogs(profile)).toContain(
      'TABLE_SCAN_DETECTED RELATION=markets',
    );
  });

  it('lists expected phase53 geo indexes for nationwide scale', () => {
    expect(EXPECTED_MARKETS_GEO_INDEXES).toContain('markets_lat_lng_idx');
    expect(EXPECTED_MARKETS_GEO_INDEXES).toContain('markets_state_city_idx');
  });

  it('GEO_QUERY_PROFILE defaults on outside production', () => {
    expect(isGeoQueryProfileEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isGeoQueryProfileEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(
      isGeoQueryProfileEnabled({ NODE_ENV: 'production', GEO_QUERY_PROFILE: '1' }),
    ).toBe(true);
  });
});
