import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type V2vConnectionStatus = 'none' | 'pending' | 'connected' | 'ignored';

@Injectable()
export class V2vConnectionsService {
  private readonly logger = new Logger(V2vConnectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async requestConnection(senderVendorId: string, receiverVendorId: string) {
    if (senderVendorId === receiverVendorId) {
      throw new BadRequestException('V2V_ERROR: CANNOT_CONNECT_SELF');
    }

    await this.assertVendorsExist(senderVendorId, receiverVendorId);

    const existing = await this.findPair(senderVendorId, receiverVendorId);
    if (existing) {
      if (existing.status === 'pending') {
        throw new ConflictException('V2V_ERROR: CONNECTION_ALREADY_PENDING');
      }
      if (existing.status === 'connected') {
        throw new ConflictException('V2V_ERROR: CONNECTION_ALREADY_ACCEPTED');
      }

      const reopened = await this.prisma.vendorConnection.update({
        where: { id: existing.id },
        data: {
          senderId: senderVendorId,
          receiverId: receiverVendorId,
          status: 'pending',
          isFollowing: existing.senderId === senderVendorId
            ? existing.isFollowing
            : existing.receiverIsFollowing,
          receiverIsFollowing: existing.senderId === senderVendorId
            ? existing.receiverIsFollowing
            : existing.isFollowing,
        },
      });
      this.logger.log(
        `V2V_CONNECTION_REQUESTED ID=${reopened.id} SENDER=${senderVendorId} RECEIVER=${receiverVendorId} REOPENED=1`,
      );
      return reopened;
    }

    const created = await this.prisma.vendorConnection.create({
      data: {
        senderId: senderVendorId,
        receiverId: receiverVendorId,
        status: 'pending',
      },
    });
    this.logger.log(
      `V2V_CONNECTION_REQUESTED ID=${created.id} SENDER=${senderVendorId} RECEIVER=${receiverVendorId}`,
    );
    return created;
  }

  async acceptConnection(receiverVendorId: string, connectionId: string) {
    const row = await this.prisma.vendorConnection.findUnique({
      where: { id: connectionId },
    });
    if (!row) {
      throw new NotFoundException('V2V_ERROR: CONNECTION_NOT_FOUND');
    }
    if (row.receiverId !== receiverVendorId) {
      throw new ForbiddenException('V2V_ERROR: ONLY_RECEIVER_CAN_ACCEPT');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('V2V_ERROR: CONNECTION_NOT_PENDING');
    }

    const updated = await this.prisma.vendorConnection.update({
      where: { id: connectionId },
      data: { status: 'connected' },
    });
    this.logger.log(
      `V2V_CONNECTION_ACCEPTED ID=${updated.id} SENDER=${updated.senderId} RECEIVER=${updated.receiverId}`,
    );
    return updated;
  }

  async ignoreConnection(actorVendorId: string, connectionId: string) {
    const row = await this.prisma.vendorConnection.findUnique({
      where: { id: connectionId },
    });
    if (!row) {
      throw new NotFoundException('V2V_ERROR: CONNECTION_NOT_FOUND');
    }
    if (row.senderId !== actorVendorId && row.receiverId !== actorVendorId) {
      throw new ForbiddenException('V2V_ERROR: NOT_CONNECTION_PARTY');
    }

    const updated = await this.prisma.vendorConnection.update({
      where: { id: connectionId },
      data: { status: 'ignored' },
    });
    this.logger.log(`V2V_CONNECTION_IGNORED ID=${updated.id} ACTOR=${actorVendorId}`);
    return updated;
  }

  async listForVendor(vendorId: string) {
    return this.prisma.vendorConnection.findMany({
      where: {
        OR: [{ senderId: vendorId }, { receiverId: vendorId }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async findPair(a: string, b: string) {
    return this.prisma.vendorConnection.findFirst({
      where: {
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
    });
  }

  private async assertVendorsExist(senderId: string, receiverId: string) {
    const [sender, receiver] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: senderId }, select: { id: true } }),
      this.prisma.vendor.findUnique({ where: { id: receiverId }, select: { id: true } }),
    ]);
    if (!sender) throw new NotFoundException('V2V_ERROR: SENDER_VENDOR_NOT_FOUND');
    if (!receiver) throw new NotFoundException('V2V_ERROR: RECEIVER_VENDOR_NOT_FOUND');
  }
}
