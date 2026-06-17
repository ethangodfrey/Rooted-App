import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PosProvider } from '@prisma/client';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { CreatePosConnectionDto } from '../dto/create-pos-connection.dto';
import { PosConnectionService } from '../services/pos-connection.service';

@Controller('pos/connections')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class PosConnectionsController {
  constructor(
    private readonly connections: PosConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Start a new POS connection. Returns authorizeUrl for OAuth providers. */
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePosConnectionDto) {
    const vendorId = this.requireVendor(user);
    const { connection, authorizeUrl, oauthRedirectUri } = await this.connections.create({
      vendorId,
      provider: dto.provider,
      displayName: dto.displayName,
      apiKey: dto.apiKey,
      providerLocationId: dto.providerLocationId,
      syncFrequencyMinutes: dto.syncFrequencyMinutes,
      appReturnUrl: dto.appReturnUrl,
    });
    return {
      connection: this.sanitize(connection),
      authorizeUrl,
      oauthRedirectUri,
      oauthEnvironment: this.oauthEnvironment(dto.provider),
    };
  }

  private oauthEnvironment(provider: PosProvider): 'sandbox' | 'production' | undefined {
    if (provider !== 'SQUARE') return undefined;
    return this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox') === 'production'
      ? 'production'
      : 'sandbox';
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = this.requireVendor(user);
    const connections = await this.connections.listForVendor(vendorId);
    return connections.map((c) => this.sanitize(c));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = this.requireVendor(user);
    return this.sanitize(await this.connections.getForVendor(vendorId, id));
  }

  /** (Re)register the provider webhook subscription for real-time updates. */
  @Post(':id/webhook')
  async registerWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = this.requireVendor(user);
    return this.sanitize(await this.connections.registerWebhook(vendorId, id));
  }

  @Delete(':id')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = this.requireVendor(user);
    return this.sanitize(await this.connections.disconnect(vendorId, id));
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new BadRequestException('Authenticated user has no vendor profile.');
    }
    return user.vendorId;
  }

  /** Strip secret-ish fields before returning a connection over the API. */
  private sanitize<T extends Record<string, unknown>>(connection: T) {
    const { webhookSecret, oauthState, ...safe } = connection as Record<string, unknown>;
    void webhookSecret;
    void oauthState;
    return safe;
  }
}
