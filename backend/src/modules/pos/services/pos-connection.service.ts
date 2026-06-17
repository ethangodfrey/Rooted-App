import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type PosConnection, type PosProvider } from '@prisma/client';

import { CredentialCipherService } from '../../../common/crypto/credential-cipher.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PosProviderAdapter } from '../adapters/provider-adapter.interface';
import {
  isHttpsUrl,
  posOAuthRedirectUri,
  posProviderBaseUrl,
  posWebhookUrl,
} from '../pos-public-url';
import { POS_DEFAULTS } from '../pos.constants';
import type { ProviderCredentials } from '../types/provider.types';
import { ProviderRegistryService } from './provider-registry.service';

export interface CreateConnectionInput {
  vendorId: string;
  provider: PosProvider;
  displayName?: string;
  /** For API-key providers (e.g. Toast restaurant GUID). */
  apiKey?: string;
  providerLocationId?: string;
  syncFrequencyMinutes?: number;
  /** Deep link the OAuth callback should redirect to (Expo Go exp:// or app scheme). */
  appReturnUrl?: string;
}

export interface CreateConnectionResult {
  connection: PosConnection;
  /** Present for OAuth providers: redirect the vendor here to authorize. */
  authorizeUrl?: string;
  /** HTTPS callback Square (etc.) must have registered in their developer console. */
  oauthRedirectUri?: string;
}

@Injectable()
export class PosConnectionService {
  private readonly logger = new Logger(PosConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: CredentialCipherService,
    private readonly registry: ProviderRegistryService,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    const adapter = this.registry.get(input.provider);

    if (adapter.authType === 'OAUTH') {
      const existingActive = await this.prisma.posConnection.findFirst({
        where: {
          vendorId: input.vendorId,
          provider: input.provider,
          status: 'ACTIVE',
        },
      });
      if (existingActive) {
        return { connection: existingActive };
      }

      const recentPending = await this.prisma.posConnection.findFirst({
        where: {
          vendorId: input.vendorId,
          provider: input.provider,
          status: 'PENDING',
          oauthState: { not: null },
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentPending?.oauthState) {
        if (input.appReturnUrl) {
          await this.prisma.posConnection.update({
            where: { id: recentPending.id },
            data: {
              metadata: {
                ...this.metaObject(recentPending.metadata),
                oauthAppReturnUrl: input.appReturnUrl,
              } as Prisma.InputJsonValue,
            },
          });
        }
        this.assertProviderPublicUrl(input.provider);
        const redirectUri = posOAuthRedirectUri(this.config, input.provider);
        const authorizeUrl = adapter.getAuthorizeUrl({
          state: recentPending.oauthState,
          redirectUri,
        });
        return {
          connection: recentPending,
          authorizeUrl,
          oauthRedirectUri: redirectUri,
        };
      }
    }

    // Drop abandoned OAuth attempts so the vendor list stays clean.
    await this.pruneStalePendingConnections(input.vendorId, input.provider);

    const connection = await this.prisma.posConnection.create({
      data: {
        vendorId: input.vendorId,
        provider: input.provider,
        authType: adapter.authType,
        displayName: input.displayName,
        providerLocationId: input.providerLocationId,
        syncFrequencyMinutes:
          input.syncFrequencyMinutes ?? POS_DEFAULTS.DEFAULT_SYNC_FREQUENCY_MINUTES,
        status: 'PENDING',
        oauthState: adapter.authType === 'OAUTH' ? randomUUID() : null,
        metadata: input.appReturnUrl
          ? ({ oauthAppReturnUrl: input.appReturnUrl } as Prisma.InputJsonValue)
          : undefined,
      },
    });

    if (adapter.authType === 'OAUTH') {
      this.assertProviderPublicUrl(input.provider);
      const redirectUri = posOAuthRedirectUri(this.config, input.provider);
      const authorizeUrl = adapter.getAuthorizeUrl({
        state: connection.oauthState!,
        redirectUri,
      });
      return { connection, authorizeUrl, oauthRedirectUri: redirectUri };
    }

    // API-key flow: validate and persist immediately.
    if (!input.apiKey) {
      await this.prisma.posConnection.delete({ where: { id: connection.id } });
      throw new BadRequestException('apiKey is required for this provider.');
    }
    const validation = await adapter.validateApiKey({ apiKey: input.apiKey });
    await this.persistCredentials(connection.id, { apiKey: input.apiKey });
    const updated = await this.prisma.posConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ACTIVE',
        providerMerchantId: validation.merchantId,
        providerLocationId: input.providerLocationId ?? validation.locationId,
      },
    });
    return { connection: updated };
  }

  /** Resolves the mobile return URL stored when the OAuth flow was started. */
  async getAppReturnUrlForOAuthState(
    provider: PosProvider,
    state: string,
  ): Promise<string | undefined> {
    const connection = await this.prisma.posConnection.findFirst({
      where: { provider, oauthState: state },
      select: { metadata: true },
    });
    return connection ? this.appReturnUrlFromMetadata(connection.metadata) : undefined;
  }

  getAppReturnUrlFromMetadata(metadata: unknown): string | undefined {
    return this.appReturnUrlFromMetadata(metadata);
  }

  /** Records a failed OAuth attempt so the vendor can see what went wrong. */
  async markOAuthStateError(
    provider: PosProvider,
    state: string,
    message: string,
  ): Promise<void> {
    const connection = await this.prisma.posConnection.findFirst({
      where: { provider, oauthState: state, status: 'PENDING' },
    });
    if (!connection) return;

    await this.prisma.posConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ERROR',
        oauthState: null,
        errorMessage: message.slice(0, 500),
      },
    });
  }

  /** Completes an OAuth flow given the provider's redirect (state + code). */
  async handleOAuthCallback(provider: PosProvider, state: string, code: string): Promise<PosConnection> {
    const connection = await this.prisma.posConnection.findFirst({
      where: { provider, oauthState: state },
    });
    if (!connection) {
      throw new NotFoundException('No pending connection matches this OAuth state.');
    }
    const adapter = this.registry.get(provider);
    const token = await adapter.exchangeOAuthCode(
      code,
      posOAuthRedirectUri(this.config, provider),
    );

    const credentials: ProviderCredentials = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt ?? null,
    };
    await this.persistCredentials(connection.id, credentials);

    // Best-effort: resolve a default provider location so syncs are scoped
    // correctly (for Square the merchant id is NOT a location id). Non-fatal.
    let providerLocationId = connection.providerLocationId;
    if (!providerLocationId) {
      try {
        const locations = await adapter.listLocations(credentials);
        providerLocationId = locations[0]?.id ?? null;
      } catch (err) {
        this.logger.warn(
          `Could not resolve default location for ${provider}: ${(err as Error).message}`,
        );
      }
    }

    // Best-effort: subscribe to provider webhooks for real-time updates so we
    // don't rely solely on scheduled polling. Non-fatal if it can't register.
    const webhook = await this.registerWebhookBestEffort(provider, adapter, credentials);

    const active = await this.prisma.posConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ACTIVE',
        oauthState: null,
        providerMerchantId: token.merchantId,
        providerLocationId,
        scopes: token.scopes ?? connection.scopes,
        webhookSecret: webhook?.secret ?? connection.webhookSecret,
        metadata: {
          ...this.metaObject(connection.metadata),
          ...(webhook ? { webhookSubscriptionId: webhook.id } : {}),
        } as Prisma.InputJsonValue,
        errorMessage: null,
      },
    });

    await this.pruneStalePendingConnections(connection.vendorId, provider, active.id);
    return active;
  }

  /** (Re)registers the provider webhook for an existing connection. */
  async registerWebhook(vendorId: string, connectionId: string): Promise<PosConnection> {
    const connection = await this.getForVendor(vendorId, connectionId);
    const adapter = this.registry.get(connection.provider);
    const credentials = await this.getUsableCredentials(connection.id);
    const webhook = await this.registerWebhookBestEffort(
      connection.provider,
      adapter,
      credentials,
    );
    if (!webhook) {
      const base = posProviderBaseUrl(this.config);
      throw new BadRequestException(
        connection.provider === 'SQUARE'
          ? !base
            ? 'Set POS_PROVIDER_BASE_URL to your HTTPS tunnel URL in backend/.env, then restart the server.'
            : 'Square webhook setup failed. Add SQUARE_ACCESS_TOKEN (Developer Dashboard → Credentials → Sandbox access token), ensure your tunnel is running, and restart the backend.'
          : 'Webhook registration is unavailable (check provider support and POS_PROVIDER_BASE_URL).',
      );
    }
    return this.prisma.posConnection.update({
      where: { id: connection.id },
      data: {
        webhookSecret: webhook.secret ?? connection.webhookSecret,
        metadata: {
          ...this.metaObject(connection.metadata),
          webhookSubscriptionId: webhook.id,
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Returns decrypted credentials, transparently refreshing an expired OAuth
   * access token and persisting the rotated tokens.
   */
  async getUsableCredentials(connectionId: string): Promise<ProviderCredentials> {
    const connection = await this.prisma.posConnection.findUniqueOrThrow({
      where: { id: connectionId },
      include: { credential: true },
    });
    if (!connection.credential) {
      throw new BadRequestException('Connection has no stored credentials.');
    }

    let creds = this.cipher.decrypt(connection.credential);
    const adapter = this.registry.get(connection.provider);

    const expired =
      creds.expiresAt && new Date(creds.expiresAt).getTime() <= Date.now() + 60_000;
    if (adapter.authType === 'OAUTH' && expired) {
      this.logger.log(`Refreshing access token for connection ${connectionId}`);
      const refreshed = await adapter.refreshAccessToken(creds);
      creds = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? creds.refreshToken,
        expiresAt: refreshed.expiresAt ?? null,
      };
      await this.persistCredentials(connectionId, creds);
    }
    return creds;
  }

  async listForVendor(vendorId: string): Promise<PosConnection[]> {
    const connections = await this.prisma.posConnection.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });

    const activeProviders = [
      ...new Set(connections.filter((c) => c.status === 'ACTIVE').map((c) => c.provider)),
    ];
    if (activeProviders.length > 0) {
      await this.prisma.posConnection.deleteMany({
        where: {
          vendorId,
          status: 'PENDING',
          provider: { in: activeProviders },
        },
      });
      return this.prisma.posConnection.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return connections;
  }

  async getForVendor(vendorId: string, connectionId: string): Promise<PosConnection> {
    const connection = await this.prisma.posConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new NotFoundException('Connection not found.');
    if (connection.vendorId !== vendorId) throw new ForbiddenException('Not your connection.');
    return connection;
  }

  async disconnect(vendorId: string, connectionId: string): Promise<PosConnection> {
    const connection = await this.getForVendor(vendorId, connectionId);
    // Remove the remote webhook subscription while we still hold credentials.
    await this.deregisterWebhookBestEffort(connection);
    // Credentials cascade-delete with the credential row; revoke remotely if the
    // provider supports it. TODO: verify with provider docs (token revocation).
    await this.prisma.posCredential.deleteMany({ where: { connectionId } });
    return this.prisma.posConnection.update({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED', webhookSecret: null },
    });
  }

  private async registerWebhookBestEffort(
    provider: PosProvider,
    adapter: PosProviderAdapter,
    credentials: ProviderCredentials,
  ): Promise<{ id: string; secret?: string } | null> {
    if (!adapter.registerWebhook) return null;
    const base = posProviderBaseUrl(this.config);
    if (!base) {
      this.logger.warn('POS_PROVIDER_BASE_URL not set; skipping webhook registration.');
      return null;
    }
    const callbackUrl = posWebhookUrl(this.config, provider);
    try {
      const result = await adapter.registerWebhook(credentials, callbackUrl);
      this.logger.log(`Registered ${provider} webhook subscription ${result.id}`);
      return result;
    } catch (err) {
      this.logger.warn(
        `Webhook registration failed for ${provider}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async deregisterWebhookBestEffort(connection: PosConnection): Promise<void> {
    const subscriptionId = this.metaObject(connection.metadata)['webhookSubscriptionId'];
    if (typeof subscriptionId !== 'string' || !subscriptionId) return;
    const adapter = this.registry.get(connection.provider);
    if (!adapter.deleteWebhook) return;
    try {
      const credentials = await this.getUsableCredentials(connection.id);
      await adapter.deleteWebhook(credentials, subscriptionId);
      this.logger.log(
        `Deleted ${connection.provider} webhook subscription ${subscriptionId}`,
      );
    } catch (err) {
      this.logger.warn(`Webhook deletion failed: ${(err as Error).message}`);
    }
  }

  /** Removes leftover PENDING rows from failed or duplicate OAuth attempts. */
  private async pruneStalePendingConnections(
    vendorId: string,
    provider: PosProvider,
    exceptId?: string,
  ): Promise<void> {
    await this.prisma.posConnection.deleteMany({
      where: {
        vendorId,
        provider,
        status: 'PENDING',
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
  }

  private metaObject(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  }

  private appReturnUrlFromMetadata(metadata: unknown): string | undefined {
    const value = this.metaObject(metadata as Prisma.JsonValue).oauthAppReturnUrl;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  async markError(connectionId: string, message: string): Promise<void> {
    await this.prisma.posConnection.update({
      where: { id: connectionId },
      data: { status: 'ERROR', errorMessage: message.slice(0, 500) },
    });
  }

  private async persistCredentials(
    connectionId: string,
    credentials: ProviderCredentials,
  ): Promise<void> {
    const encrypted = this.cipher.encrypt(credentials);
    await this.prisma.posCredential.upsert({
      where: { connectionId },
      create: {
        connectionId,
        secretCipher: encrypted.secretCipher,
        cipherIv: encrypted.cipherIv,
        cipherAuthTag: encrypted.cipherAuthTag,
        keyVersion: encrypted.keyVersion,
        expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
      },
      update: {
        secretCipher: encrypted.secretCipher,
        cipherIv: encrypted.cipherIv,
        cipherAuthTag: encrypted.cipherAuthTag,
        keyVersion: encrypted.keyVersion,
        expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
      },
    });
  }

  /** Public HTTPS redirect URI providers must whitelist (e.g. Square OAuth settings). */
  getOAuthRedirectUri(provider: PosProvider): string {
    this.assertProviderPublicUrl(provider);
    return posOAuthRedirectUri(this.config, provider);
  }

  private assertProviderPublicUrl(provider: PosProvider): void {
    if (provider !== 'SQUARE') return;

    const base = posProviderBaseUrl(this.config);
    if (!base) {
      throw new BadRequestException(
        'POS_PROVIDER_BASE_URL (or PUBLIC_BASE_URL) is required for Square OAuth.',
      );
    }
    if (!isHttpsUrl(base)) {
      throw new BadRequestException(
        'Square OAuth requires an HTTPS redirect URL. Set POS_PROVIDER_BASE_URL to your HTTPS tunnel (e.g. https://abc123.ngrok-free.app). The mobile app can still use a LAN IP for EXPO_PUBLIC_API_URL. See docs/SQUARE_SETUP.md.',
      );
    }
  }
}
