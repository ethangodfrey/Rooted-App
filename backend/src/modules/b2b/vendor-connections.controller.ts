import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseVendorConnectionRequest } from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { VendorConnectionsService } from './vendor-connections.service';

@Controller('api/vendors/connections')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class VendorConnectionsController {
  constructor(private readonly connections: VendorConnectionsService) {}

  /**
   * POST /api/vendors/connections/request
   * Body: { receiverVendorId: uuid }
   */
  @Post('request')
  @HttpCode(201)
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    const parsed = parseVendorConnectionRequest(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const connection = await this.connections.requestConnection(
      vendorId,
      parsed.DATA.receiverVendorId,
    );

    return {
      STATUS: 'B2B_CONNECTION_REQUESTED',
      CONNECTION: {
        ID: connection.id,
        SENDER_VENDOR_ID: connection.senderVendorId,
        RECEIVER_VENDOR_ID: connection.receiverVendorId,
        STATUS: connection.status,
        INITIATED_AT: connection.initiatedAt.toISOString(),
      },
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = this.requireVendor(user);
    const rows = await this.connections.listForVendor(vendorId);
    return {
      STATUS: 'B2B_CONNECTIONS_LIST',
      COUNT: rows.length,
      CONNECTIONS: rows.map((row) => ({
        ID: row.id,
        SENDER_VENDOR_ID: row.senderVendorId,
        RECEIVER_VENDOR_ID: row.receiverVendorId,
        STATUS: row.status,
        INITIATED_AT: row.initiatedAt.toISOString(),
      })),
    };
  }

  /** GET /api/vendors/connections/with/:peerVendorId */
  @Get('with/:peerVendorId')
  async withPeer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('peerVendorId', ParseUUIDPipe) peerVendorId: string,
  ) {
    const vendorId = this.requireVendor(user);
    const row = await this.connections.findWithPeer(vendorId, peerVendorId);
    if (!row) {
      return {
        STATUS: 'B2B_CONNECTION_ABSENT',
        PEER_VENDOR_ID: peerVendorId,
        CONNECTION: null,
      };
    }
    return {
      STATUS: 'B2B_CONNECTION_STATUS',
      PEER_VENDOR_ID: peerVendorId,
      CONNECTION: {
        ID: row.id,
        SENDER_VENDOR_ID: row.senderVendorId,
        RECEIVER_VENDOR_ID: row.receiverVendorId,
        STATUS: row.status,
        INITIATED_AT: row.initiatedAt.toISOString(),
      },
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
