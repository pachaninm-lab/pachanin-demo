import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { MappingProperty } from '@elastic/elasticsearch/lib/api/types';

const LOTS_INDEX = 'grainflow_lots';
const DEALS_INDEX = 'grainflow_deals';

/**
 * Видимая деградация поиска (CANONICAL_SCENARIO.md §0.3): статус доступности
 * Elasticsearch публикуется в /api/health/detailed, а не тонет в warn-логах.
 */
let searchAvailability: 'ok' | 'degraded' = 'degraded';
export function searchAvailabilityStatus(): 'ok' | 'degraded' {
  return searchAvailability;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly es: ElasticsearchService) {}

  async onModuleInit() {
    await this.ensureIndices();
  }

  private async ensureIndices() {
    searchAvailability = 'ok';
    await this.createIndexIfNotExists(LOTS_INDEX, {
      id: { type: 'keyword' },
      organizationId: { type: 'keyword' },
      cropType: { type: 'keyword' },
      cropClass: { type: 'keyword' },
      region: { type: 'keyword' },
      volumeTons: { type: 'float' },
      priceKopecks: { type: 'long' },
      status: { type: 'keyword' },
      description: { type: 'text', analyzer: 'russian' },
      createdAt: { type: 'date' },
      expiresAt: { type: 'date' },
    });

    await this.createIndexIfNotExists(DEALS_INDEX, {
      id: { type: 'keyword' },
      sellerOrgId: { type: 'keyword' },
      buyerOrgId: { type: 'keyword' },
      cropType: { type: 'keyword' },
      cropClass: { type: 'keyword' },
      region: { type: 'keyword' },
      volumeTons: { type: 'float' },
      totalKopecks: { type: 'long' },
      status: { type: 'keyword' },
      createdAt: { type: 'date' },
    });
  }

  private async createIndexIfNotExists(index: string, mappingProperties: Record<string, MappingProperty>) {
    try {
      const exists = await this.es.indices.exists({ index });
      if (!exists) {
        await this.es.indices.create({
          index,
          body: {
            settings: {
              number_of_shards: 2,
              number_of_replicas: 1,
              analysis: {
                analyzer: {
                  russian: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'russian_stemmer'],
                  },
                },
                filter: {
                  russian_stemmer: {
                    type: 'stemmer',
                    language: 'russian',
                  },
                },
              },
            },
            mappings: { properties: mappingProperties },
          },
        });
        this.logger.log(`Created index: ${index}`);
      }
    } catch (err) {
      searchAvailability = 'degraded';
      this.logger.warn(`Failed to create index ${index}: ${err}`);
    }
  }

  async indexLot<T extends { id: string }>(lot: T) {
    try {
      await this.es.index({
        index: LOTS_INDEX,
        id: lot.id,
        document: lot,
      });
    } catch (err) {
      this.logger.warn(`Failed to index lot ${lot.id}: ${err}`);
    }
  }

  async indexDeal<T extends { id: string }>(deal: T) {
    try {
      await this.es.index({
        index: DEALS_INDEX,
        id: deal.id,
        document: deal,
      });
    } catch (err) {
      this.logger.warn(`Failed to index deal ${deal.id}: ${err}`);
    }
  }

  async searchLots(params: {
    q?: string;
    cropType?: string;
    region?: string;
    minVolume?: number;
    maxVolume?: number;
    status?: string;
    from?: number;
    size?: number;
  }) {
    const must: object[] = [];
    const filter: object[] = [];

    if (params.q) {
      must.push({
        multi_match: {
          query: params.q,
          fields: ['description', 'region', 'cropType'],
          analyzer: 'russian',
        },
      });
    }

    if (params.cropType) filter.push({ term: { cropType: params.cropType } });
    if (params.region) filter.push({ term: { region: params.region } });
    if (params.status) filter.push({ term: { status: params.status } });

    if (params.minVolume !== undefined || params.maxVolume !== undefined) {
      const range: Record<string, number> = {};
      if (params.minVolume !== undefined) range['gte'] = params.minVolume;
      if (params.maxVolume !== undefined) range['lte'] = params.maxVolume;
      filter.push({ range: { volumeTons: range } });
    }

    const result = await this.es.search({
      index: LOTS_INDEX,
      from: params.from || 0,
      size: params.size || 20,
      body: {
        query: {
          bool: { must: must.length ? must : [{ match_all: {} }], filter },
        },
        sort: [{ createdAt: { order: 'desc' } }],
      },
    });

    return {
      total: (result.hits.total as { value: number }).value,
      hits: result.hits.hits.map((h) => ({ id: h._id, ...(h._source as Record<string, unknown>) })),
    };
  }

  async deleteLot(id: string) {
    await this.es.delete({ index: LOTS_INDEX, id }).catch(() => {});
  }

  async deleteDeal(id: string) {
    await this.es.delete({ index: DEALS_INDEX, id }).catch(() => {});
  }
}
