import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueryImportedTransactionsDto } from '../dto/query-imported-transactions.dto';
import { TriggerSyncDto } from '../dto/trigger-sync.dto';
import { mapImportedTransactionForApi } from '../mappers/pos-transaction.mapper';
import { PosConnectionService } from '../services/pos-connection.service';
import { PosSyncService } from '../services/pos-sync.service';

@Controller('pos')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class PosSyncController {
  constructor(
    private readonly connections: PosConnectionService,
    private readonly sync: PosSyncService,
    private readonly prisma: PrismaService,
  ) {}

  /** Manually trigger a sync for one of the vendor's connections. */
  @Post('connections/:id/sync')
  async trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriggerSyncDto,
  ) {
    const vendorId = this.requireVendor(user);
    await this.connections.getForVendor(vendorId, id);
    const run = await this.sync.queueSync(id, dto.backfill ? 'BACKFILL' : 'MANUAL', {
      since: dto.since,
      until: dto.until,
    });
    return { syncRunId: run.id, status: run.status };
  }

  @Get('connections/:id/sync-runs')
  async runs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vendorId = this.requireVendor(user);
    await this.connections.getForVendor(vendorId, id);
    return this.sync.listRuns(id);
  }

  /** List normalized imported transactions for the vendor's analytics view. */
  @Get('transactions')
  async transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryImportedTransactionsDto,
  ) {
    const vendorId = this.requireVendor(user);
    const where: Prisma.PosImportedTransactionWhereInput = {
      vendorId,
      connectionId: query.connectionId,
      soldAt:
        query.since || query.until
          ? { gte: query.since ? new Date(query.since) : undefined, lte: query.until ? new Date(query.until) : undefined }
          : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.posImportedTransaction.findMany({
        where,
        include: {
          lineItems: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
        orderBy: { soldAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.posImportedTransaction.count({ where }),
    ]);
    return {
      total,
      items: items.map((item) => mapImportedTransactionForApi(item)),
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new BadRequestException('Authenticated user has no vendor profile.');
    }
    return user.vendorId;
  }
}
