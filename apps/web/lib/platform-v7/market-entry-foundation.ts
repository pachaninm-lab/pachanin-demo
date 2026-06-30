export type MarketEntryStatus = 'ready' | 'partial' | 'source_required' | 'blocked';
export type MarketEntryTone = 'good' | 'warn' | 'bad' | 'neutral' | 'money';

export interface MarketEntryFlowStep {
  readonly title: string;
  readonly text: string;
}

export const MARKET_ENTRY_FLOW: readonly MarketEntryFlowStep[] = [
  { title: 'Цена', text: 'Культура, регион, базис и источник цены фиксируются до заявки.' },
  { title: 'Заявка', text: 'Сторона формирует намерение с объемом, качеством и сроком.' },
  { title: 'Предложение', text: 'Условия сравниваются по цене, логистике, оплате, документам и риску.' },
  { title: 'Проверка', text: 'Контрагент, документы и финансовая готовность проходят предсделочный gate.' },
  { title: 'Сделка', text: 'Проверенное предложение переходит в контур исполнения.' },
  { title: 'Исполнение', text: 'Рейс, приемка, качество, документы, деньги, спор и доказательства остаются внутри процесса.' },
] as const;

export function marketEntryStatusLabel(status: MarketEntryStatus): string {
  if (status === 'ready') return 'готово';
  if (status === 'partial') return 'частично';
  if (status === 'source_required') return 'нужен источник';
  return 'стоп';
}
