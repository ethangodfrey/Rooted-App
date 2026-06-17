import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { PosProvider } from '@prisma/client';
import type { Response } from 'express';

import { OAuthCallbackDto } from '../dto/oauth-callback.dto';
import { PosConnectionService } from '../services/pos-connection.service';
import { PosSyncService } from '../services/pos-sync.service';
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
  ) {}

  /** Returns the HTTPS redirect URI to register in the provider developer console. */
  @Get(':provider/redirect-uri')
  redirectUri(@Param('provider') providerParam: string) {
    const provider = this.parseProvider(providerParam);
    const redirectUri = this.connections.getOAuthRedirectUri(provider);
    const providerBaseUrl = redirectUri.replace(/\/pos\/oauth\/[^/]+\/callback$/, '');
    return {
      redirectUri,
      providerBaseUrl,
      hint:
        provider === 'SQUARE'
          ? 'Add redirectUri exactly under OAuth → Redirect URL (Sandbox) in the Square Developer Dashboard, then restart the backend after any tunnel URL change.'
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
