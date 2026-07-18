import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  formatSeedSummary,
  runLocalNetworkSeed,
  type LocalNetworkSeedResult,
} from './local-network-seed.runner';

@Injectable()
export class AdminSeedNetworkService {
  private readonly logger = new Logger(AdminSeedNetworkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<LocalNetworkSeedResult & { summary: string }> {
    this.logger.log('NETWORK SEED: START DENVER CLUSTER');
    const result = await runLocalNetworkSeed(this.prisma);
    const summary = formatSeedSummary(result);
    this.logger.log(summary);
    return { ...result, summary };
  }
}
