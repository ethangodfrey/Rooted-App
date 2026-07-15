import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { describeDatabaseTarget, normalizeDatabaseUrl } from './normalize-database-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
    super(
      url
        ? {
            datasources: {
              db: { url },
            },
          }
        : undefined,
    );

    const target = describeDatabaseTarget(url ?? process.env.DATABASE_URL);
    if (target) {
      this.logger.log(`Prisma datasource target: ${target}`);
    }
  }

  async onModuleInit(): Promise<void> {
    // Don't take the whole app down if the DB isn't reachable at boot; Prisma
    // will lazily (re)connect on the first successful query.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Database connection failed at startup: ${(err as Error).message}. Will retry on demand.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Reconnect helper for readiness probes after transient pooler failures. */
  async ensureConnected(): Promise<void> {
    await this.$connect();
  }
}
