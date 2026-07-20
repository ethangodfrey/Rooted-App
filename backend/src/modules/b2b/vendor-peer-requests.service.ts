import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  VendorBusinessConnectionStatus,
  VendorPeerConnectionStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Phase 11 peer-to-peer connection engine.
 * Table: vendor_peer_connections (requestor_id, recipient_id, PENDING|ACCEPTED|BLOCKED).
 * Telemetry: CONNECTION_REQUEST_INITIATED, WHOLESALE_RELATIONSHIP_ESTABLISHED
 */
@Injectable()
export class VendorPeerRequestsService {
  private readonly logger = new Logger(VendorPeerRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async initiateRequest(requestorId: string, recipientId: string) {
    if (requestorId === recipientId) {
      throw new BadRequestException('PEER_VALIDATION_ERROR: CANNOT_CONNECT_SELF');
    }

    const [requestor, recipient] = await Promise.all([
      this.prisma.vendor.findUnique({
        where: { id: requestorId },
        select: { id: true },
      }),
      this.prisma.vendor.findUnique({
        where: { id: recipientId },
        select: { id: true },
      }),
    ]);

    if (!requestor) {
      throw new NotFoundException('PEER_ERROR: REQUESTOR_VENDOR_NOT_FOUND');
    }
    if (!recipient) {
      throw new NotFoundException('PEER_ERROR: RECIPIENT_VENDOR_NOT_FOUND');
    }

    const existing = await this.prisma.vendorPeerConnection.findFirst({
      where: {
        OR: [
          { requestorId, recipientId },
          { requestorId: recipientId, recipientId: requestorId },
        ],
      },
    });

    if (existing) {
      if (existing.status === VendorPeerConnectionStatus.PENDING) {
        throw new ConflictException('PEER_ERROR: CONNECTION_ALREADY_PENDING');
      }
      if (existing.status === VendorPeerConnectionStatus.ACCEPTED) {
        throw new ConflictException('PEER_ERROR: CONNECTION_ALREADY_ACCEPTED');
      }
      if (existing.status === VendorPeerConnectionStatus.BLOCKED) {
        throw new ConflictException('PEER_ERROR: CONNECTION_BLOCKED');
      }
    }

    const created = await this.prisma.vendorPeerConnection.create({
      data: {
        requestorId,
        recipientId,
        status: VendorPeerConnectionStatus.PENDING,
      },
    });

    this.logger.log(
      `CONNECTION_REQUEST_INITIATED ID=${created.id} REQUESTOR=${requestorId} RECIPIENT=${recipientId}`,
    );

    // Keep phase54 business edge in sync for legacy wholesale draft checks.
    await this.mirrorBusinessConnectionPending(requestorId, recipientId);

    return created;
  }

  async updateRequestStatus(
    sessionVendorId: string,
    requestId: string,
    status: 'ACCEPTED' | 'BLOCKED',
  ) {
    const existing = await this.prisma.vendorPeerConnection.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      throw new NotFoundException('PEER_ERROR: REQUEST_NOT_FOUND');
    }

    const isRequestor = existing.requestorId === sessionVendorId;
    const isRecipient = existing.recipientId === sessionVendorId;
    if (!isRequestor && !isRecipient) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=PEER_REQUEST_UPDATE SESSION=${sessionVendorId} REQUEST=${requestId}`,
      );
      throw new ForbiddenException('PEER_ERROR: CROSS_TENANT_FORBIDDEN');
    }

    if (status === 'ACCEPTED') {
      if (!isRecipient) {
        throw new ForbiddenException(
          'PEER_ERROR: ONLY_RECIPIENT_MAY_ACCEPT',
        );
      }
      if (existing.status === VendorPeerConnectionStatus.BLOCKED) {
        throw new ConflictException('PEER_ERROR: CONNECTION_BLOCKED');
      }
      if (existing.status === VendorPeerConnectionStatus.ACCEPTED) {
        return existing;
      }
    }

    const updated = await this.prisma.vendorPeerConnection.update({
      where: { id: requestId },
      data: {
        status:
          status === 'ACCEPTED'
            ? VendorPeerConnectionStatus.ACCEPTED
            : VendorPeerConnectionStatus.BLOCKED,
      },
    });

    if (updated.status === VendorPeerConnectionStatus.ACCEPTED) {
      this.logger.log(
        `WHOLESALE_RELATIONSHIP_ESTABLISHED ID=${updated.id} REQUESTOR=${updated.requestorId} RECIPIENT=${updated.recipientId}`,
      );
      await this.mirrorBusinessConnectionAccepted(
        updated.requestorId,
        updated.recipientId,
      );
    } else {
      this.logger.log(
        `CONNECTION_REQUEST_BLOCKED ID=${updated.id} REQUESTOR=${updated.requestorId} RECIPIENT=${updated.recipientId} BY=${sessionVendorId}`,
      );
      await this.mirrorBusinessConnectionDeclined(
        updated.requestorId,
        updated.recipientId,
      );
    }

    return updated;
  }

  async listForVendor(vendorId: string) {
    return this.prisma.vendorPeerConnection.findMany({
      where: {
        OR: [{ requestorId: vendorId }, { recipientId: vendorId }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAcceptedBetween(vendorA: string, vendorB: string) {
    return this.prisma.vendorPeerConnection.findFirst({
      where: {
        status: VendorPeerConnectionStatus.ACCEPTED,
        OR: [
          { requestorId: vendorA, recipientId: vendorB },
          { requestorId: vendorB, recipientId: vendorA },
        ],
      },
    });
  }

  private async mirrorBusinessConnectionPending(
    requestorId: string,
    recipientId: string,
  ): Promise<void> {
    const existing = await this.prisma.vendorBusinessConnection.findFirst({
      where: {
        OR: [
          { senderVendorId: requestorId, receiverVendorId: recipientId },
          { senderVendorId: recipientId, receiverVendorId: requestorId },
        ],
      },
    });
    if (!existing) {
      await this.prisma.vendorBusinessConnection.create({
        data: {
          senderVendorId: requestorId,
          receiverVendorId: recipientId,
          status: VendorBusinessConnectionStatus.PENDING,
        },
      });
      return;
    }
    if (existing.status === VendorBusinessConnectionStatus.DECLINED) {
      await this.prisma.vendorBusinessConnection.update({
        where: { id: existing.id },
        data: {
          senderVendorId: requestorId,
          receiverVendorId: recipientId,
          status: VendorBusinessConnectionStatus.PENDING,
          initiatedAt: new Date(),
        },
      });
    }
  }

  private async mirrorBusinessConnectionAccepted(
    requestorId: string,
    recipientId: string,
  ): Promise<void> {
    const existing = await this.prisma.vendorBusinessConnection.findFirst({
      where: {
        OR: [
          { senderVendorId: requestorId, receiverVendorId: recipientId },
          { senderVendorId: recipientId, receiverVendorId: requestorId },
        ],
      },
    });
    if (!existing) {
      await this.prisma.vendorBusinessConnection.create({
        data: {
          senderVendorId: requestorId,
          receiverVendorId: recipientId,
          status: VendorBusinessConnectionStatus.ACCEPTED,
        },
      });
      return;
    }
    if (existing.status !== VendorBusinessConnectionStatus.ACCEPTED) {
      await this.prisma.vendorBusinessConnection.update({
        where: { id: existing.id },
        data: { status: VendorBusinessConnectionStatus.ACCEPTED },
      });
    }
  }

  private async mirrorBusinessConnectionDeclined(
    requestorId: string,
    recipientId: string,
  ): Promise<void> {
    const existing = await this.prisma.vendorBusinessConnection.findFirst({
      where: {
        OR: [
          { senderVendorId: requestorId, receiverVendorId: recipientId },
          { senderVendorId: recipientId, receiverVendorId: requestorId },
        ],
      },
    });
    if (!existing) return;
    if (existing.status !== VendorBusinessConnectionStatus.DECLINED) {
      await this.prisma.vendorBusinessConnection.update({
        where: { id: existing.id },
        data: { status: VendorBusinessConnectionStatus.DECLINED },
      });
    }
  }
}
