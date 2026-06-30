import type { MarketSide } from './market-entry-foundation';
import type { MarketIntentApiResult } from './market-entry-api';

export interface SubmitMarketIntentInput {
  readonly side: MarketSide;
  readonly volume: string;
  readonly sourcePriceId: string;
  readonly routeId: string;
}

type FetchLike = (input: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<MarketIntentApiResult> }>;

export async function submitMarketIntent(input: SubmitMarketIntentInput, fetcher: FetchLike = fetch): Promise<MarketIntentApiResult> {
  try {
    const response = await fetcher('/api/platform-v7/market-intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json();
    if (!response.ok) return { status: 'rejected', draft: null, message: payload.message || 'Сервер отклонил намерение.' };
    return payload;
  } catch {
    return { status: 'rejected', draft: null, message: 'API намерений недоступен.' };
  }
}
