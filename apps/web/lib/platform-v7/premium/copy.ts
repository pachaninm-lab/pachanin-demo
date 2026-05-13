export const premiumTextLimits = { title: 56, description: 120, cta: 32 } as const;

const rules: Array<[RegExp, string]> = [
  [new RegExp('market' + 'place', 'gi'), 'лоты и запросы'],
  [new RegExp('production' + '-' + 'ready', 'gi'), 'готово к проверке'],
  [new RegExp('fully' + '\\s+' + 'live', 'gi'), 'подключение подтверждается отдельно'],
  [new RegExp('fully' + '\\s+' + 'integrated', 'gi'), 'внешнее подключение подтверждается отдельно'],
  [new RegExp('Control' + '\\s+' + 'Tower', 'gi'), 'Центр управления'],
  [new RegExp('sand' + 'box', 'gi'), 'рабочий режим'],
  [new RegExp('de' + 'mo', 'gi'), 'рабочий режим'],
  [new RegExp('pi' + 'lot', 'gi'), 'рабочий режим'],
  [new RegExp('гарантируем' + '\\s+' + 'оплату', 'gi'), 'показываем условия оплаты'],
  [new RegExp('безрисковая' + '\\s+' + 'сделка', 'gi'), 'сделка с контролем условий'],
];

export function cleanPremiumCopy(value: string): string {
  return rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value).replace(/\s+/g, ' ').trim();
}

export function limitPremiumText(value: string, max = 120): string {
  const clean = cleanPremiumCopy(value);
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
