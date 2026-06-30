import type { MarketSide } from './market-entry-data';

export function marketIntentActionLabel(side: MarketSide): string {
  return side === 'sell' ? 'Создать лот продавца' : 'Создать RFQ покупателя';
}

export function marketIntentTargetHref(side: MarketSide): string {
  return side === 'sell' ? '/platform-v7/lots/create' : '/platform-v7/buyer/rfq/new';
}
