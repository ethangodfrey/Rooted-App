'use client';

import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type { MarketDirectoryContext } from '@/lib/markets/directory';
import {
  resolveMarketBannerText,
  resolveMarketLocationLine,
} from '@/lib/markets/directory';

import type { TenantConfig, TenantResolution } from './types';

export interface MarketThemeValue {
  tenant: TenantConfig;
  market: MarketDirectoryContext | null;
  resolvedHost: string;
  resolution: TenantResolution;
  title: string;
  bannerText: string | null;
  locationLine: string | null;
  operatingHours: string | null;
  primaryColor: string;
  accentColor: string;
  cssVariables: CSSProperties;
}

const MarketThemeContext = createContext<MarketThemeValue | null>(null);

const DEFAULT_PRIMARY = '#1f6b4f';
const DEFAULT_ACCENT = '#e8a838';

export function buildMarketThemeValue(input: {
  tenant: TenantConfig;
  market: MarketDirectoryContext | null;
  resolvedHost: string;
  resolution: TenantResolution;
}): MarketThemeValue {
  const { tenant, market, resolvedHost, resolution } = input;
  const primaryColor =
    market?.themePrimaryColor?.trim() ||
    tenant.branding.primaryColor?.trim() ||
    DEFAULT_PRIMARY;
  const accentColor =
    market?.themeAccentColor?.trim() ||
    tenant.branding.accentColor?.trim() ||
    DEFAULT_ACCENT;
  const title = market?.name?.trim() || tenant.displayName;
  const bannerText = market ? resolveMarketBannerText(market) : tenant.branding.tagline;
  const locationLine = market ? resolveMarketLocationLine(market) : null;
  const operatingHours = market?.operatingHours?.trim() || null;

  const cssVariables = {
    ['--tenant-primary' as string]: primaryColor,
    ['--tenant-accent' as string]: accentColor,
    ['--market-title-color' as string]: primaryColor,
    ['--market-banner-accent' as string]: accentColor,
  } as CSSProperties;

  return {
    tenant,
    market,
    resolvedHost,
    resolution,
    title,
    bannerText,
    locationLine,
    operatingHours,
    primaryColor,
    accentColor,
    cssVariables,
  };
}

export function MarketThemeProvider({
  value,
  children,
}: {
  value: MarketThemeValue;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return (
    <MarketThemeContext.Provider value={memo}>
      <div style={memo.cssVariables}>{children}</div>
    </MarketThemeContext.Provider>
  );
}

export function useMarketTheme(): MarketThemeValue {
  const ctx = useContext(MarketThemeContext);
  if (!ctx) {
    throw new Error('useMarketTheme must be used within a MarketThemeProvider');
  }
  return ctx;
}
