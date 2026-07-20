import { useCallback, useEffect, useState } from 'react';

import { isApiConfigured } from '@/lib/api';
import {
  fetchEngagementAnalyticsSummary,
  type EngagementAnalyticsSummary,
  type EngagementSeriesPoint,
} from '@/lib/engagement-analytics';
import './engagement-performance.css';

function maxCount(series: EngagementSeriesPoint[]): number {
  return Math.max(1, ...series.map((point) => point.count));
}

function SparkBars({
  series,
  muted = false,
}: {
  series: EngagementSeriesPoint[];
  muted?: boolean;
}) {
  const max = maxCount(series);
  if (series.every((point) => point.count === 0)) {
    return <p className="engagement-perf__empty">NO DATA IN RANGE</p>;
  }
  return (
    <div className="engagement-perf__spark" role="img" aria-label="Trend chart">
      {series.map((point) => (
        <div
          key={point.date}
          className={`engagement-perf__spark-bar${muted ? ' engagement-perf__spark-bar--muted' : ''}`}
          style={{ height: `${Math.max(4, Math.round((point.count / max) * 100))}%` }}
          title={`${point.date}: ${point.count}`}
        />
      ))}
    </div>
  );
}

type EngagementPerformancePanelProps = {
  days?: number;
};

export function EngagementPerformancePanel({
  days = 30,
}: EngagementPerformancePanelProps) {
  const [data, setData] = useState<EngagementAnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setError('API is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const summary = await fetchEngagementAnalyticsSummary(days);
      setData(summary);
      setError(null);
      console.log(
        `METRICS_SYNC_COMPLETE ENTITY=${summary.ENTITY_ID} DAYS=${summary.DAYS} TOTAL=${summary.TOTALS.postReach + summary.TOTALS.inquiries + summary.TOTALS.rsvps}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load engagement metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    console.log('ANALYTICS_DASHBOARD_INITIALIZED SURFACE=ENGAGEMENT');
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="engagement-perf__empty">LOADING PERFORMANCE</p>;
  }

  if (!data) {
    return (
      <div className="engagement-perf">
        {error ? <p className="pos-telemetry__error">{error}</p> : null}
        <p className="engagement-perf__empty">NO ENGAGEMENT METRICS YET</p>
      </div>
    );
  }

  return (
    <div className="engagement-perf">
      {error ? <p className="pos-telemetry__error">{error}</p> : null}

      <div className="engagement-perf__grid" aria-label="Engagement totals">
        <article className="engagement-perf__metric">
          <p className="engagement-perf__metric-label">Post reach</p>
          <p className="engagement-perf__metric-value">{data.TOTALS.postReach}</p>
        </article>
        <article className="engagement-perf__metric">
          <p className="engagement-perf__metric-label">Inquiries</p>
          <p className="engagement-perf__metric-value">{data.TOTALS.inquiries}</p>
        </article>
        <article className="engagement-perf__metric">
          <p className="engagement-perf__metric-label">RSVPs</p>
          <p className="engagement-perf__metric-value">{data.TOTALS.rsvps}</p>
        </article>
        <article className="engagement-perf__metric">
          <p className="engagement-perf__metric-label">Collaborations</p>
          <p className="engagement-perf__metric-value">{data.TOTALS.collaborations}</p>
        </article>
      </div>

      <div className="engagement-perf__charts">
        <section className="engagement-perf__chart">
          <h3 className="engagement-perf__chart-title">Post Reach</h3>
          <p className="engagement-perf__chart-copy">
            Views across posts over the last {data.DAYS} days.
          </p>
          <SparkBars series={data.SERIES.POST_REACH} />
        </section>
        <section className="engagement-perf__chart">
          <h3 className="engagement-perf__chart-title">Inquiries over time</h3>
          <p className="engagement-perf__chart-copy">
            Catering and engagement inquiries by day.
          </p>
          <SparkBars series={data.SERIES.INQUIRIES} />
        </section>
      </div>

      <p className="engagement-perf__meta">
        {data.POSTS.COUNT} posts · {data.POSTS.PARTNERSHIP_COUNT} partnerships ·{' '}
        {data.CATERING.INQUIRY_COUNT} catering inquiries ({data.CATERING.OPEN_COUNT} open)
      </p>
      <button type="button" className="pos-telemetry__btn" onClick={() => void load()}>
        [ REFRESH PERFORMANCE ]
      </button>
    </div>
  );
}
