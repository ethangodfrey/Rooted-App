import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

/**
 * Optional Elasticsearch client. When ELASTICSEARCH_NODE is unset, callers skip
 * network IO and keep catalog mutations online.
 */
@Injectable()
export class ElasticsearchClientService implements OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchClientService.name);
  private readonly client: Client | null;
  private readonly indexName: string;

  constructor(private readonly config: ConfigService) {
    const node = (this.config.get<string>('ELASTICSEARCH_NODE') ?? '').trim();
    this.indexName = (
      this.config.get<string>('ELASTICSEARCH_WHOLESALE_INDEX') ??
      'wholesale_products'
    ).trim();

    if (!node) {
      this.client = null;
      this.logger.log('ELASTICSEARCH_CLIENT_DISABLED REASON=NODE_UNSET');
      return;
    }

    const username = (
      this.config.get<string>('ELASTICSEARCH_USERNAME') ?? ''
    ).trim();
    const password = (
      this.config.get<string>('ELASTICSEARCH_PASSWORD') ?? ''
    ).trim();

    this.client = new Client({
      node,
      ...(username && password
        ? { auth: { username, password } }
        : {}),
    });
    this.logger.log(
      `ELASTICSEARCH_CLIENT_READY NODE=${node} INDEX=${this.indexName}`,
    );
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getClient(): Client | null {
    return this.client;
  }

  wholesaleIndex(): string {
    return this.indexName;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}
