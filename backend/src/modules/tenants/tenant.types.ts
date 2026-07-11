import type { PosConnectionStatus, PosProvider, TenantStatus } from '@prisma/client';

export interface TenantBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  tagline: string | null;
}

export interface TenantPosIntegrationPublic {
  provider: PosProvider;
  status: PosConnectionStatus;
  providerAppId: string | null;
  providerLocationId: string | null;
  webhookEndpoint: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TenantConfig {
  id: string;
  slug: string;
  displayName: string;
  status: TenantStatus;
  eventId: string | null;
  branding: TenantBranding;
  metadata: Record<string, unknown>;
  posIntegrations: TenantPosIntegrationPublic[];
}

export interface TenantResolveResult {
  tenant: TenantConfig;
  resolvedHost: string;
  resolution: 'custom_domain' | 'subdomain' | 'slug_path';
}

export interface TenantCacheEnvelope {
  fetchedAt: number;
  tenant: TenantConfig;
  resolvedHost: string;
  resolution: TenantResolveResult['resolution'];
}
