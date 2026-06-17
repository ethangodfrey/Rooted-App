import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

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
}
