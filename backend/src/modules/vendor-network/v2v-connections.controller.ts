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

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { V2vConnectionsService } from './v2v-connections.service';

@Controller('api/v2v/connections')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class V2vConnectionsController {
  constructor(
    private readonly connections: V2vConnectionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/v2v/connections
   * Body: { receiverVendorId: uuid }
   */
  @Post()
  @HttpCode(201)
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = await this.resolveVendorId(user);
    const receiverVendorId = this.readReceiverId(body);
    return this.connections.requestConnection(vendorId, receiverVendorId);
  }

  /** GET /api/v2v/connections */
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = await this.resolveVendorId(user);
    return this.connections.listForVendor(vendorId);
  }

  /** POST /api/v2v/connections/:id/accept */
  @Post(':id/accept')
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.connections.acceptConnection(vendorId, id);
  }

  /** POST /api/v2v/connections/:id/ignore */
  @Post(':id/ignore')
  async ignore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.connections.ignoreConnection(vendorId, id);
  }

  private readReceiverId(body: unknown): string {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('V2V_VALIDATION_ERROR: BODY_REQUIRED');
    }
    const raw = body as Record<string, unknown>;
    const id = raw.receiverVendorId ?? raw.receiver_vendor_id ?? raw.receiverId;
    if (typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('V2V_VALIDATION_ERROR: RECEIVER_VENDOR_ID_REQUIRED');
    }
    return id.trim();
  }

  private async resolveVendorId(user: AuthenticatedUser): Promise<string> {
    const vendor = await this.prisma.vendor.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!vendor) {
      throw new UnauthorizedException('V2V_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return vendor.id;
  }
}
