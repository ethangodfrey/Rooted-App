import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type PosProvider } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { PosSyncService } from './pos-sync.service';
import { ProviderRegistryService } from './provider-registry.service';

export interface InboundWebhook {
  provider: PosProvider;
  rawBody: Buffer | string;
  headers: Record<string, string | undefined>;
}

/** Event-type prefixes that should trigger an incremental sync. */
const SYNC_RELEVANT_PREFIXES = ['payment.', 'refund.', 'order.'];

/** True when a provider event affects sales data and warrants a re-sync. */
export function isWebhookSyncRelevant(eventType: string): boolean {
  return SYNC_RELEVANT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}

@Injectable()
export class PosWebhookService {
  private readonly logger = new Logger(PosWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly sync: PosSyncService,
  ) {}

  /**
   * Verifies, persists (idempotently), and acts on a provider webhook. Always
   * returns quickly with 2xx semantics; heavy work is deferred to the sync queue.
   */
  async handleInbound(inbound: InboundWebhook): Promise<{ accepted: boolean }> {
    const adapter = this.registry.get(inbound.provider);

    // First pass: parse + verify with provider-level secret (config default).
    let parsed = adapter.verifyWebhook({
      rawBody: inbound.rawBody,
      headers: inbound.headers,
    });

    // Resolve the connection so we can re-verify with a per-connection secret.
    const connection = await this.resolveConnection(inbound.provider, parsed);
    if (connection?.webhookSecret) {
      parsed = adapter.verifyWebhook({
        rawBody: inbound.rawBody,
        headers: inbound.headers,
        secret: connection.webhookSecret,
      });
    }

    const payload = this.safeParse(inbound.rawBody);

    // Idempotent insert on (provider, providerEventId).
    const existing = await this.prisma.posWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: inbound.provider,
          providerEventId: parsed.providerEventId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      this.logger.debug(`Duplicate webhook ${inbound.provider}:${parsed.providerEventId} ignored`);
      return { accepted: true };
    }

    const event = await this.prisma.posWebhookEvent.create({
      data: {
        connectionId: connection?.id,
        provider: inbound.provider,
        providerEventId: parsed.providerEventId || `unverified:${Date.now()}`,
        eventType: parsed.eventType,
        signatureValid: parsed.signatureValid,
        status: parsed.signatureValid ? 'RECEIVED' : 'FAILED',
        payload: payload as Prisma.InputJsonValue,
        error: parsed.signatureValid ? null : 'Signature verification failed',
      },
    });

    if (!parsed.signatureValid) {
      this.logger.warn(`Rejected webhook with invalid signature: ${event.id}`);
      return { accepted: false };
    }

    if (connection && connection.status === 'ACTIVE' && isWebhookSyncRelevant(parsed.eventType)) {
      await this.sync.queueSync(connection.id, 'WEBHOOK');
      await this.prisma.posWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    } else {
      await this.prisma.posWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'IGNORED', processedAt: new Date() },
      });
    }

    return { accepted: true };
  }

  private resolveConnection(provider: PosProvider, parsed: { providerMerchantId?: string; providerLocationId?: string }) {
    if (parsed.providerMerchantId) {
      return this.prisma.posConnection.findFirst({
        where: { provider, providerMerchantId: parsed.providerMerchantId },
      });
    }
    if (parsed.providerLocationId) {
      return this.prisma.posConnection.findFirst({
        where: { provider, providerLocationId: parsed.providerLocationId },
      });
    }
    return Promise.resolve(null);
  }

  private safeParse(rawBody: Buffer | string): unknown {
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return { _unparsed: raw };
    }
  }
}
