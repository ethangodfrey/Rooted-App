export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type PosProvider = 'SQUARE' | 'TOAST' | 'CLOVER';

export type PosConnectionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'ERROR'
  | 'EXPIRED'
  | 'DISCONNECTED';

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

export type TenantResolution = 'custom_domain' | 'subdomain' | 'slug_path';

export interface TenantCacheEnvelope {
  fetchedAt: number;
  tenant: TenantConfig;
  resolvedHost: string;
  resolution: TenantResolution;
}

export interface TenantResolveResponse {
  tenant: TenantConfig;
  resolvedHost: string;
  resolution: TenantResolution;
  cache?: 'fresh' | 'stale' | 'miss' | 'refresh';
}

export class TenantNotFoundError extends Error {
  readonly host: string;

  constructor(host: string) {
    super(`No active tenant for host "${host}"`);
    this.name = 'TenantNotFoundError';
    this.host = host;
  }
}

export class TenantSuspendedError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Tenant "${slug}" is not active`);
    this.name = 'TenantSuspendedError';
    this.slug = slug;
  }
}
