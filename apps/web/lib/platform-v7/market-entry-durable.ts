import type { MarketIntentDraft } from './market-entry-intent';

export type MarketIntentDurableStatus = 'stored' | 'unavailable' | 'rejected';

export interface MarketIntentDurableRecord {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly ownerId: string;
  readonly auditEventId: string;
  readonly draft: MarketIntentDraft;
}

export interface MarketIntentDurableResult {
  readonly status: MarketIntentDurableStatus;
  readonly record: MarketIntentDurableRecord | null;
  readonly message: string;
}

export interface MarketIntentDurableAdapter {
  saveMarketIntent(input: {
    readonly ownerId: string;
    readonly auditEventId: string;
    readonly draft: MarketIntentDraft;
  }): Promise<MarketIntentDurableResult>;
}

export const unavailableMarketIntentDurableAdapter: MarketIntentDurableAdapter = {
  async saveMarketIntent() {
    return {
      status: 'unavailable',
      record: null,
      message: 'Durable storage for market intents is not wired yet.',
    };
  },
};

export function canExposeMarketIntentAsDurable(result: MarketIntentDurableResult): boolean {
  return result.status === 'stored' && result.record !== null;
}
