export interface MarketEntryRiskFlag {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly action: string;
}

export const MARKET_ENTRY_RISK_FLAGS: readonly MarketEntryRiskFlag[] = [
  { id: 'price-source', title: 'Источник цены', text: 'Цена без источника и даты не должна становиться основанием сделки.', action: 'Проверить источник перед запуском.' },
  { id: 'route-rate', title: 'Ставка перевозки', text: 'Расчет логистики предварительный до подтверждения перевозчиком.', action: 'Подтвердить ставку и срок подачи транспорта.' },
  { id: 'counterparty', title: 'Контрагент', text: 'Предложение не должно запускать сделку без проверки стороны.', action: 'Проверить ИНН, документы и историю.' },
  { id: 'money', title: 'Деньги', text: 'Платформа не двигает деньги без банкового основания.', action: 'Связать сделку с банковым контуром.' },
] as const;
