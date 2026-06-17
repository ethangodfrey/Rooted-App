import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { Text } from '@/src/components/ui/text';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface LineSeries {
  data: ChartPoint[];
  color: string;
}

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const PADDING = { top: 12, right: 12, bottom: 36, left: 40 };
const AXIS_COLOR = '#E5E7EB';
const LABEL_COLOR = '#9CAF88';

function niceMax(value: number, floor = 1): number {
  if (value <= 0) return floor;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
) {
  const large = end - start > 180 ? 1 : 0;
  const oStart = polar(cx, cy, outerR, start);
  const oEnd = polar(cx, cy, outerR, end);
  const iEnd = polar(cx, cy, innerR, end);
  const iStart = polar(cx, cy, innerR, start);
  if (innerR <= 0) {
    return `M ${cx} ${cy} L ${oStart.x} ${oStart.y} A ${outerR} ${outerR} 0 ${large} 1 ${oEnd.x} ${oEnd.y} Z`;
  }
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ');
}

function formatAxisValue(value: number, currency: boolean): string {
  if (currency) {
    return value >= 100 ? `$${Math.round(value)}` : value >= 1 ? `$${value.toFixed(0)}` : `$${value.toFixed(1)}`;
  }
  return value >= 10 ? String(Math.round(value)) : value % 1 === 0 ? String(value) : value.toFixed(1);
}

function ChartGrid({
  width,
  height,
  maxValue,
  sections = 4,
  currency = true,
}: {
  width: number;
  height: number;
  maxValue: number;
  sections?: number;
  currency?: boolean;
}) {
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const lines = [];
  for (let i = 0; i <= sections; i++) {
    const y = PADDING.top + (plotH * i) / sections;
    const val = maxValue - (maxValue * i) / sections;
    lines.push(
      <G key={i}>
        <Line
          x1={PADDING.left}
          y1={y}
          x2={width - PADDING.right}
          y2={y}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />
        <SvgText
          x={PADDING.left - 6}
          y={y + 4}
          fontSize={9}
          fill={LABEL_COLOR}
          textAnchor="end">
          {formatAxisValue(val, currency)}
        </SvgText>
      </G>,
    );
  }
  return <>{lines}</>;
}

export function MultiLineChart({
  series,
  height = 220,
  minWidth = 300,
  maxValue: maxOverride,
}: {
  series: LineSeries[];
  height?: number;
  minWidth?: number;
  maxValue?: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const count = series[0]?.data.length ?? 0;
  if (count === 0) return null;

  const width = Math.max(minWidth, count * 48 + PADDING.left + PADDING.right);
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const maxValue = niceMax(
    maxOverride ??
      Math.max(...series.flatMap((s) => s.data.map((d) => d.value)), 0),
  );
  const step = count > 1 ? plotW / (count - 1) : plotW;

  const toPoint = (index: number, value: number) => ({
    x: PADDING.left + index * step,
    y: PADDING.top + plotH - (value / maxValue) * plotH,
  });
  const dotRadius = count <= 7 ? 6 : 4;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [count, width]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height}>
        <ChartGrid width={width} height={height} maxValue={maxValue} />
        {series.map((s) => {
          const points = s.data
            .map((d, i) => {
              const p = toPoint(i, d.value);
              return `${p.x},${p.y}`;
            })
            .join(' ');
          return (
            <G key={s.color}>
              <Polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.data.map((d, i) => {
                const p = toPoint(i, d.value);
                if (d.value <= 0) return null;
                return (
                  <Circle key={`${s.color}-${i}`} cx={p.x} cy={p.y} r={dotRadius} fill={s.color} />
                );
              })}
            </G>
          );
        })}
        {series[0].data.map((d, i) => {
          const x = PADDING.left + i * step;
          return (
            <SvgText
              key={d.label + i}
              x={x}
              y={height - 10}
              fontSize={9}
              fill={LABEL_COLOR}
              textAnchor="middle">
              {d.label}
            </SvgText>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export function SingleLineChart({
  data,
  color,
  height = 200,
  minWidth = 300,
  maxValue: maxOverride,
}: {
  data: ChartPoint[];
  color: string;
  height?: number;
  minWidth?: number;
  maxValue?: number;
}) {
  return (
    <MultiLineChart
      series={[{ data, color }]}
      height={height}
      minWidth={minWidth}
      maxValue={maxOverride}
    />
  );
}

export function VerticalBarChart({
  data,
  color,
  height = 200,
  minWidth = 300,
  maxValue: maxOverride,
  currency = false,
}: {
  data: ChartPoint[];
  color: string;
  height?: number;
  minWidth?: number;
  maxValue?: number;
  currency?: boolean;
}) {
  if (data.length === 0) return null;

  const scrollRef = useRef<ScrollView>(null);
  const width = Math.max(minWidth, data.length * 48 + PADDING.left + PADDING.right);
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const maxValue = niceMax(maxOverride ?? Math.max(...data.map((d) => d.value), 0), 1);
  const barW = Math.min(28, Math.max(12, plotW / data.length - 8));
  const slot = plotW / data.length;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [data.length, width]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height}>
        <ChartGrid
          width={width}
          height={height}
          maxValue={maxValue}
          sections={4}
          currency={currency}
        />
        {data.map((d, i) => {
          const barH = d.value > 0 ? Math.max(8, (d.value / maxValue) * plotH) : 0;
          const x = PADDING.left + i * slot + (slot - barW) / 2;
          const y = PADDING.top + plotH - barH;
          if (d.value <= 0) return null;
          return (
            <G key={d.label + i}>
              <Path
                d={`M ${x} ${y + 4} Q ${x} ${y} ${x + 4} ${y} L ${x + barW - 4} ${y} Q ${x + barW} ${y} ${x + barW} ${y + 4} L ${x + barW} ${y + barH} L ${x} ${y + barH} Z`}
                fill={color}
              />
              <SvgText
                x={x + barW / 2}
                y={height - 10}
                fontSize={9}
                fill={LABEL_COLOR}
                textAnchor="middle">
                {d.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export function HorizontalBarChart({
  data,
  color,
  formatValue = (v) => String(v),
}: {
  data: ChartPoint[];
  color: string;
  formatValue?: (v: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View className="gap-3">
      {data.map((d) => (
        <View key={d.label}>
          <View className="mb-1 flex-row items-center justify-between">
            <Text variant="caption" className="flex-1 pr-2" numberOfLines={1}>
              {d.label}
            </Text>
            <Text variant="caption" className="font-semibold">
              {formatValue(d.value)}
            </Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-stone-100">
            <View
              className="h-3 rounded-full"
              style={{
                width: `${Math.max(4, (d.value / maxValue) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DonutChart({
  slices,
  size = 160,
  innerRadiusRatio = 0.55,
  centerLabel,
}: {
  slices: PieSlice[];
  size?: number;
  innerRadiusRatio?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * innerRadiusRatio;
  let cursor = 0;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {slices.map((slice) => {
          const angle = (slice.value / total) * 360;
          const start = cursor;
          const end = cursor + angle;
          cursor = end;
          if (angle <= 0) return null;
          return (
            <Path
              key={slice.label}
              d={slicePath(cx, cy, outerR, innerR, start, end)}
              fill={slice.color}
            />
          );
        })}
      </Svg>
      {centerLabel ? (
        <View className="absolute items-center justify-center" style={{ width: size, height: size }}>
          <Text variant="caption" className="font-semibold">
            {centerLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function PieChartView({ slices, size = 160 }: { slices: PieSlice[]; size?: number }) {
  return <DonutChart slices={slices} size={size} innerRadiusRatio={0} />;
}
