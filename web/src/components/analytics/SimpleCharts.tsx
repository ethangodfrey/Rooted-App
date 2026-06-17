import type { ReactNode } from 'react';

import './analytics.css';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <div className="analytics-legend-row">
      <span className="analytics-legend-dot" style={{ background: color }} />
      <span>{label}</span>
      {value != null ? <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{value}</span> : null}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-card analytics-chart-card">
      <p className="analytics-chart-title">{title}</p>
      {subtitle ? <p className="analytics-chart-subtitle">{subtitle}</p> : null}
      {legend ? <div className="analytics-legend">{legend}</div> : null}
      {children}
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return <div className="analytics-empty">{message}</div>;
}

export function VerticalBarChart({
  data,
  color,
  maxValue,
}: {
  data: ChartPoint[];
  color: string;
  maxValue: number;
}) {
  const max = maxValue > 0 ? maxValue : 1;
  return (
    <div className="analytics-bars">
      {data.map((d) => (
        <div key={d.label} className="analytics-bar-group">
          <div className="analytics-bar-stack">
            <div
              className="analytics-bar"
              style={{
                height: `${Math.max(2, (d.value / max) * 140)}px`,
                background: color,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="analytics-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StackedRevenueChart({
  data,
  maxValue,
}: {
  data: {
    label: string;
    reservations: number;
    inPerson: number;
    cardSales: number;
  }[];
  maxValue: number;
}) {
  const max = maxValue > 0 ? maxValue : 1;
  const colors = { reservations: '#228B22', inPerson: '#50C878', cardSales: '#d97706' };

  return (
    <div className="analytics-bars">
      {data.map((d) => {
        const total = d.reservations + d.inPerson + d.cardSales;
        const scale = (v: number) => (total > 0 ? (v / max) * 140 : 0);
        return (
          <div key={d.label} className="analytics-bar-group">
            <div className="analytics-bar-stack">
              <div
                className="analytics-bar"
                style={{ height: `${Math.max(total > 0 ? 2 : 0, scale(d.reservations))}px`, background: colors.reservations }}
                title={`Reservations: $${(d.reservations / 100).toFixed(2)}`}
              />
              <div
                className="analytics-bar"
                style={{ height: `${Math.max(total > 0 ? 2 : 0, scale(d.inPerson))}px`, background: colors.inPerson }}
                title={`In-person: $${(d.inPerson / 100).toFixed(2)}`}
              />
              <div
                className="analytics-bar"
                style={{ height: `${Math.max(total > 0 ? 2 : 0, scale(d.cardSales))}px`, background: colors.cardSales }}
                title={`Card: $${(d.cardSales / 100).toFixed(2)}`}
              />
            </div>
            <span className="analytics-bar-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBarChart({
  data,
  color,
  formatValue,
}: {
  data: ChartPoint[];
  color: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="analytics-hbars">
      {data.map((d) => (
        <div key={d.label}>
          <div className="analytics-hbar-row">
            <span className="analytics-hbar-label" title={d.label}>
              {d.label}
            </span>
            <div className="analytics-hbar-track">
              <div
                className="analytics-hbar-fill"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
          </div>
          {formatValue ? (
            <p className="analytics-hbar-value">{formatValue(d.value)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  slices,
  centerLabel,
}: {
  slices: ChartSlice[];
  centerLabel: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <EmptyChart message="No data." />;

  let cursor = 0;
  const stops = slices.map((s) => {
    const pct = (s.value / total) * 100;
    const start = cursor;
    cursor += pct;
    return `${s.color} ${start}% ${cursor}%`;
  });

  return (
    <div className="analytics-donut-wrap">
      <div
        className="analytics-donut"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="analytics-donut-hole">{centerLabel}</div>
      </div>
    </div>
  );
}

export function PieLegend({ slices, formatValue }: { slices: ChartSlice[]; formatValue?: (v: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {slices.map((s) => (
        <LegendRow
          key={s.label}
          color={s.color}
          label={s.label}
          value={formatValue ? formatValue(s.value) : String(s.value)}
        />
      ))}
      {total === 0 ? null : null}
    </div>
  );
}
