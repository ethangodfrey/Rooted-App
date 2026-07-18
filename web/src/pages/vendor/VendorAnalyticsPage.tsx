import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  formatUsd,
  loadPosTelemetrySuite,
  type PosTelemetrySuite,
} from '@/lib/pos-analytics';
import './pos-analytics.css';

function barWidth(value: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export function VendorAnalyticsPage() {
  const { user } = useAuth();
  const vendorId = user?.id ?? null;
  const [data, setData] = useState<PosTelemetrySuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!vendorId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const suite = await loadPosTelemetrySuite(vendorId);
      setData(suite);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load telemetry');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="pos-telemetry">
        <p className="pos-telemetry__empty">LOADING TELEMETRY</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pos-telemetry">
        {error ? <p className="pos-telemetry__error">{error}</p> : null}
        <p className="pos-telemetry__empty">SIGN IN AS A VENDOR TO VIEW ANALYTICS</p>
      </div>
    );
  }

  const fulfillmentMax = Math.max(
    data.fulfillment.completed,
    data.fulfillment.cancelled,
    data.fulfillment.pending,
    1,
  );
  const sourceMax = Math.max(...data.sourceBreakdown.map((row) => row.amount), 1);
  const connectedCount = data.integrations.filter((row) => row.credentials_connected).length;

  return (
    <div className="pos-telemetry">
      <header className="pos-telemetry__header">
        <div>
          <p className="pos-telemetry__kicker">REVENUE · VOLUME · POS SYNC</p>
          <h1 className="pos-telemetry__title">Business Telemetry</h1>
        </div>
        <div className="pos-telemetry__actions">
          <Link to="/vendor/analytics/integrations" className="pos-telemetry__btn pos-telemetry__btn--solid">
            [ POS SYNC ]
          </Link>
          <button type="button" className="pos-telemetry__btn" onClick={() => void load()}>
            [ REFRESH ]
          </button>
        </div>
      </header>

      {error ? <p className="pos-telemetry__error">{error}</p> : null}

      <section className="pos-telemetry__metrics" aria-label="Core metrics">
        <article className="pos-telemetry__metric">
          <p className="pos-telemetry__metric-label">TOTAL GROSS REVENUE</p>
          <p className="pos-telemetry__metric-value">{formatUsd(data.totalGrossRevenue)}</p>
        </article>
        <article className="pos-telemetry__metric">
          <p className="pos-telemetry__metric-label">ACTIVE PRE-ORDER VALUE</p>
          <p className="pos-telemetry__metric-value">{formatUsd(data.activePreorderValue)}</p>
        </article>
        <article className="pos-telemetry__metric">
          <p className="pos-telemetry__metric-label">TOTAL SALES VOLUME</p>
          <p className="pos-telemetry__metric-value">{data.totalSalesVolume}</p>
        </article>
      </section>

      <section className="pos-telemetry__section">
        <h2 className="pos-telemetry__section-title">FULFILLMENT ANALYTICS</h2>
        <p className="pos-telemetry__section-copy">
          Completed pickups against cancellations, with pending hand-offs held out of the success rate.
        </p>
        <div className="pos-telemetry__fulfillment">
          <div className="pos-telemetry__bars">
            <div className="pos-telemetry__bar-row">
              <p className="pos-telemetry__bar-label">COMPLETED</p>
              <div className="pos-telemetry__bar-track">
                <div
                  className="pos-telemetry__bar-fill"
                  style={{ width: barWidth(data.fulfillment.completed, fulfillmentMax) }}
                />
              </div>
              <p className="pos-telemetry__bar-value">{data.fulfillment.completed}</p>
            </div>
            <div className="pos-telemetry__bar-row">
              <p className="pos-telemetry__bar-label">CANCELLED</p>
              <div className="pos-telemetry__bar-track">
                <div
                  className="pos-telemetry__bar-fill pos-telemetry__bar-fill--muted"
                  style={{ width: barWidth(data.fulfillment.cancelled, fulfillmentMax) }}
                />
              </div>
              <p className="pos-telemetry__bar-value">{data.fulfillment.cancelled}</p>
            </div>
            <div className="pos-telemetry__bar-row">
              <p className="pos-telemetry__bar-label">PENDING</p>
              <div className="pos-telemetry__bar-track">
                <div
                  className="pos-telemetry__bar-fill"
                  style={{
                    width: barWidth(data.fulfillment.pending, fulfillmentMax),
                    opacity: 0.45,
                  }}
                />
              </div>
              <p className="pos-telemetry__bar-value">{data.fulfillment.pending}</p>
            </div>
          </div>
          <div className="pos-telemetry__rate">
            <p className="pos-telemetry__rate-label">PICKUP SUCCESS RATE</p>
            <p className="pos-telemetry__rate-value">{data.fulfillment.successRate}%</p>
            <p className="pos-telemetry__section-copy" style={{ marginBottom: 0 }}>
              {connectedCount} POS CHANNEL{connectedCount === 1 ? '' : 'S'} CONNECTED
            </p>
          </div>
        </div>
      </section>

      <section className="pos-telemetry__section">
        <h2 className="pos-telemetry__section-title">PRODUCT VELOCITY TRACKER</h2>
        <p className="pos-telemetry__section-copy">
          Highest-grossing products and specialties from platform pre-orders combined with synced
          external inputs when available.
        </p>
        {data.productVelocity.length === 0 ? (
          <p className="pos-telemetry__empty">NO PRODUCT VELOCITY YET</p>
        ) : (
          <div className="pos-telemetry__list">
            {data.productVelocity.map((row, index) => (
              <div key={`${row.name}-${index}`} className="pos-telemetry__list-row">
                <p className="pos-telemetry__rank">{String(index + 1).padStart(2, '0')}</p>
                <div>
                  <p className="pos-telemetry__list-name">{row.name}</p>
                  <p className="pos-telemetry__list-meta">{row.units} UNITS</p>
                </div>
                <p className="pos-telemetry__list-value">{formatUsd(row.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pos-telemetry__section">
        <h2 className="pos-telemetry__section-title">SOURCE BREAKDOWN</h2>
        <p className="pos-telemetry__section-copy">
          Revenue contribution by channel across Square, Toast, Stripe Native, and cash hand-offs.
        </p>
        <div className="pos-telemetry__list">
          {data.sourceBreakdown.map((row) => (
            <div key={row.source} className="pos-telemetry__source-row">
              <div>
                <p className="pos-telemetry__source-label">
                  {row.label}: {formatUsd(row.amount)}
                </p>
                <div className="pos-telemetry__bar-track" style={{ marginTop: '0.45rem' }}>
                  <div
                    className="pos-telemetry__bar-fill"
                    style={{ width: barWidth(row.amount, sourceMax) }}
                  />
                </div>
              </div>
              <p className="pos-telemetry__source-amount">
                {sourceMax > 0 ? `${Math.round((row.amount / sourceMax) * 100)}%` : '0%'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
