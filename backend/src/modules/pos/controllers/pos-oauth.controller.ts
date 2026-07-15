import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PosProvider } from '@prisma/client';
import type { Response } from 'express';

import { OAuthCallbackDto } from '../dto/oauth-callback.dto';
import { posOAuthRedirectUri, posProviderBaseUrl } from '../pos-public-url';
import { PosConnectionService } from '../services/pos-connection.service';
import { PosSyncService } from '../services/pos-sync.service';
import {
  normalizeSquareEnvironment,
  squareAuthorizeBaseUrl,
} from '../square-environment';
import { renderOAuthReturnHtml } from '../utils/oauth-return-html';

/**
 * Public OAuth redirect target. Providers redirect the merchant's browser here
 * after authorization; the `state` correlates back to the pending connection.
 */
@Controller('pos/oauth')
export class PosOAuthController {
  constructor(
    private readonly connections: PosConnectionService,
    private readonly sync: PosSyncService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Public Square/Nest POS OAuth readiness (no secrets).
   * Use to verify Railway env after setting SQUARE_APPLICATION_* + PUBLIC_BASE_URL.
   */
  @Get('square/config-status')
  squareConfigStatus() {
    const applicationId = this.config.get<string>('SQUARE_APPLICATION_ID', '').trim();
    const applicationSecret = this.config
      .get<string>('SQUARE_APPLICATION_SECRET', '')
      .trim();
    const environmentRaw = this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox').trim();
    const environment = normalizeSquareEnvironment(environmentRaw);
    const isProduction = environment === 'production';
    const authorizeBaseUrl = squareAuthorizeBaseUrl(environment);
    const providerBaseUrl = posProviderBaseUrl(this.config);
    const redirectUri = posOAuthRedirectUri(this.config, 'SQUARE');
    const scopes = ['ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ'];
    // Application ID is public in OAuth authorize URLs; include a clickable sample
    // so operators can verify host + client_id + redirect_uri without a vendor session.
    let sampleAuthorizeUrl: string | null = null;
    if (applicationId) {
      const params = new URLSearchParams({
        client_id: applicationId,
        scope: scopes.join(' '),
        state: 'config-status-preview',
        redirect_uri: redirectUri,
      });
      sampleAuthorizeUrl = `${authorizeBaseUrl}/oauth2/authorize?${params.toString()}`;
    }
    return {
      provider: 'SQUARE',
      environment,
      environmentRaw,
      authorizeBaseUrl,
      authorizePath: `${authorizeBaseUrl}/oauth2/authorize`,
      // NOTE: correct sandbox host is connect.squareupsandbox.com (with "connect."),
      // not squareupsandbox.com.
      // Public Application ID prefix only — safe to expose for env matching.
      applicationIdPrefix: applicationId
        ? `${applicationId.slice(0, 10)}…${applicationId.slice(-4)}`
        : null,
      squareApplicationIdConfigured: Boolean(applicationId),
      squareApplicationSecretConfigured: Boolean(applicationSecret),
      providerBaseUrl,
      redirectUri,
      scopes,
      sampleAuthorizeUrl,
      ready: Boolean(applicationId && applicationSecret && providerBaseUrl),
      sandboxSellerLaunchRequired: !isProduction,
      squareDashboardHint: isProduction
        ? 'Use Production Application ID/secret and register redirectUri under OAuth → Redirect URL (Production).'
        : 'Sandbox OAuth requires opening a Sandbox test account (Developer Console → Sandbox test accounts → Open) in this same browser before Authorize. Also register redirectUri under OAuth → Redirect URL (Sandbox).',
    };
  }

  /** Returns the HTTPS redirect URI to register in the provider developer console. */
  @Get(':provider/redirect-uri')
  redirectUri(@Param('provider') providerParam: string) {
    const provider = this.parseProvider(providerParam);
    const redirectUri = this.connections.getOAuthRedirectUri(provider);
    const providerBaseUrl = redirectUri.replace(/\/pos\/oauth\/[^/]+\/callback$/, '');
    const environment = normalizeSquareEnvironment(
      this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox'),
    );
    return {
      redirectUri,
      providerBaseUrl,
      hint:
        provider === 'SQUARE'
          ? `Add redirectUri exactly under OAuth → Redirect URL (${environment === 'production' ? 'Production' : 'Sandbox'}) in the Square Developer Dashboard.`
          : 'Register redirectUri as the OAuth callback for this provider.',
    };
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') providerParam: string,
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    const provider = this.parseProvider(providerParam);

    if (query.error || !query.code) {
      const detail = query.error_description ?? query.error ?? 'missing_code';
      if (query.state) {
        await this.connections.markOAuthStateError(provider, query.state, detail);
      }
      return this.renderReturnPage(res, 'error', detail);
    }

    try {
      const connection = await this.connections.handleOAuthCallback(
        provider,
        query.state,
        query.code,
      );
      // Kick off an initial backfill import; non-fatal if the queue is down.
      try {
        await this.sync.queueSync(connection.id, 'BACKFILL');
      } catch {
        // Logged inside the sync service / queue layer.
      }
      return this.renderReturnPage(res, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'oauth_failed';
      await this.connections.markOAuthStateError(provider, query.state, message);
      return this.renderReturnPage(res, 'error', message);
    }
  }

  private parseProvider(value: string): PosProvider {
    const upper = value.toUpperCase();
    if (!(upper in PosProvider)) {
      throw new BadRequestException(`Unknown provider: ${value}`);
    }
    return upper as PosProvider;
  }

  private renderReturnPage(
    res: Response,
    status: 'success' | 'error',
    detail?: string,
  ): void {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderOAuthReturnHtml(status, detail));
  }
}
