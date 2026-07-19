import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  parseVendorPeerRequestCreate,
  parseVendorPeerRequestUpdate,
} from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { VendorPeerRequestsService } from './vendor-peer-requests.service';

@Controller('api/vendors/requests')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class VendorPeerRequestsController {
  constructor(private readonly peerRequests: VendorPeerRequestsService) {}

  /**
   * POST /api/vendors/requests
   * Body: { recipient_id | recipientId: uuid }
   */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const requestorId = this.requireVendor(user);
    const parsed = parseVendorPeerRequestCreate(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const connection = await this.peerRequests.initiateRequest(
      requestorId,
      parsed.DATA.recipientId,
    );

    return {
      STATUS: 'CONNECTION_REQUEST_INITIATED',
      REQUEST: this.serialize(connection),
    };
  }

  /**
   * PATCH /api/vendors/requests/:requestId
   * Body: { status: 'ACCEPTED' | 'BLOCKED' }
   */
  @Patch(':requestId')
  @HttpCode(200)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: unknown,
  ) {
    const sessionVendorId = this.requireVendor(user);
    const parsed = parseVendorPeerRequestUpdate(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const connection = await this.peerRequests.updateRequestStatus(
      sessionVendorId,
      requestId,
      parsed.DATA.status,
    );

    return {
      STATUS:
        connection.status === 'ACCEPTED'
          ? 'WHOLESALE_RELATIONSHIP_ESTABLISHED'
          : 'CONNECTION_REQUEST_BLOCKED',
      REQUEST: this.serialize(connection),
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = this.requireVendor(user);
    const rows = await this.peerRequests.listForVendor(vendorId);
    return {
      STATUS: 'CONNECTION_REQUESTS_LIST',
      COUNT: rows.length,
      REQUESTS: rows.map((row) => this.serialize(row)),
    };
  }

  private serialize(row: {
    id: string;
    requestorId: string;
    recipientId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ID: row.id,
      REQUESTOR_ID: row.requestorId,
      RECIPIENT_ID: row.recipientId,
      STATUS: row.status,
      CREATED_AT: row.createdAt.toISOString(),
      UPDATED_AT: row.updatedAt.toISOString(),
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('PEER_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
