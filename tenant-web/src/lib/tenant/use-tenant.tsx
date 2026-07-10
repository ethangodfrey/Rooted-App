'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type { TenantConfig, TenantResolution } from './types';

export interface TenantContextValue {
  tenant: TenantConfig;
  resolvedHost: string;
  resolution: TenantResolution;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantContextValue;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return <TenantContext.Provider value={memo}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
}

export function useTenantBranding() {
  const { tenant } = useTenant();
  return tenant.branding;
}

export function useTenantPosIntegrations() {
  const { tenant } = useTenant();
  return tenant.posIntegrations;
}
