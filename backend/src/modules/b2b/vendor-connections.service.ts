import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { VendorBusinessConnectionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorConnectionsService {
  private readonly logger = new Logger(VendorConnectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async requestConnection(senderVendorId: string, receiverVendorId: string) {
    if (senderVendorId === receiverVendorId) {
      throw new BadRequestException('B2B_VALIDATION_ERROR: CANNOT_CONNECT_SELF');
    }

    const [sender, receiver] = await Promise.all([
      this.prisma.vendor.findUnique({
        where: { id: senderVendorId },
        select: { id: true },
      }),
      this.prisma.vendor.findUnique({
        where: { id: receiverVendorId },
        select: { id: true },
      }),
    ]);

    if (!sender) {
      throw new NotFoundException('B2B_ERROR: SENDER_VENDOR_NOT_FOUND');
    }
    if (!receiver) {
      throw new NotFoundException('B2B_ERROR: RECEIVER_VENDOR_NOT_FOUND');
    }

    const existing = await this.prisma.vendorBusinessConnection.findFirst({
      where: {
        OR: [
          { senderVendorId, receiverVendorId },
          {
            senderVendorId: receiverVendorId,
            receiverVendorId: senderVendorId,
          },
        ],
      },
    });

    if (existing) {
      if (existing.status === VendorBusinessConnectionStatus.PENDING) {
        throw new ConflictException('B2B_ERROR: CONNECTION_ALREADY_PENDING');
      }
      if (existing.status === VendorBusinessConnectionStatus.ACCEPTED) {
        throw new ConflictException('B2B_ERROR: CONNECTION_ALREADY_ACCEPTED');
      }
      // Re-open a previously declined pair from the new sender.
      const reopened = await this.prisma.vendorBusinessConnection.update({
        where: { id: existing.id },
        data: {
          senderVendorId,
          receiverVendorId,
          status: VendorBusinessConnectionStatus.PENDING,
          initiatedAt: new Date(),
        },
      });
      this.logger.log(
        `B2B_CONNECTION_REQUESTED ID=${reopened.id} SENDER=${senderVendorId} RECEIVER=${receiverVendorId} REOPENED=1`,
      );
      return reopened;
    }

    const created = await this.prisma.vendorBusinessConnection.create({
      data: {
        senderVendorId,
        receiverVendorId,
        status: VendorBusinessConnectionStatus.PENDING,
      },
    });

    this.logger.log(
      `B2B_CONNECTION_REQUESTED ID=${created.id} SENDER=${senderVendorId} RECEIVER=${receiverVendorId}`,
    );
    return created;
  }

  async listForVendor(vendorId: string) {
    return this.prisma.vendorBusinessConnection.findMany({
      where: {
        OR: [{ senderVendorId: vendorId }, { receiverVendorId: vendorId }],
      },
      orderBy: { initiatedAt: 'desc' },
    });
  }

  /**
   * ACCEPTED peer vendor IDs for CONNECTED_WHOLESALERS discovery ranking.
   */
  async listAcceptedConnectedVendorIds(vendorId: string): Promise<string[]> {
    const rows = await this.prisma.vendorBusinessConnection.findMany({
      where: {
        status: VendorBusinessConnectionStatus.ACCEPTED,
        OR: [{ senderVendorId: vendorId }, { receiverVendorId: vendorId }],
      },
      select: { senderVendorId: true, receiverVendorId: true },
    });

    const peers = new Set<string>();
    for (const row of rows) {
      if (row.senderVendorId !== vendorId) peers.add(row.senderVendorId);
      if (row.receiverVendorId !== vendorId) peers.add(row.receiverVendorId);
    }
    return [...peers];
  }

  async findWithPeer(viewerVendorId: string, peerVendorId: string) {
    return this.prisma.vendorBusinessConnection.findFirst({
      where: {
        OR: [
          {
            senderVendorId: viewerVendorId,
            receiverVendorId: peerVendorId,
          },
          {
            senderVendorId: peerVendorId,
            receiverVendorId: viewerVendorId,
          },
        ],
      },
    });
  }

  /**
   * Ownership-gated status update — only sender/receiver may mutate the edge.
   * Mirrors vendor_business_connections RLS update policy.
   */
  async updateStatusForVendor(
    sessionVendorId: string,
    connectionId: string,
    status: VendorBusinessConnectionStatus,
  ) {
    const existing = await this.prisma.vendorBusinessConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        senderVendorId: true,
        receiverVendorId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('B2B_ERROR: CONNECTION_NOT_FOUND');
    }

    const participant =
      existing.senderVendorId === sessionVendorId ||
      existing.receiverVendorId === sessionVendorId;

    if (!participant) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=CONNECTION_UPDATE SESSION=${sessionVendorId} CONNECTION=${connectionId}`,
      );
      throw new ForbiddenException('B2B_ERROR: CROSS_TENANT_FORBIDDEN');
    }

    return this.prisma.vendorBusinessConnection.update({
      where: { id: connectionId },
      data: { status },
    });
  }
}
