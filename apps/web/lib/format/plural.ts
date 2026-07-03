/**
 * Русское склонение существительных (и согласованных с ними слов) при числительных.
 *
 * Три формы: one («1 рейс»), few («2 рейса»), many («5 рейсов»).
 * Правило CLDR для ru: one — n % 10 = 1 и n % 100 ≠ 11;
 * few — n % 10 ∈ 2..4 и n % 100 ∉ 12..14; иначе many.
 */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «2 активных рейса»: число + правильно склонённая фраза одной строкой. */
export function countRu(n: number, one: string, few: string, many: string): string {
  return `${n} ${pluralRu(n, one, few, many)}`;
}

/** Частотные счётные фразы платформы — чтобы формы не расползались по экранам. */
export const RU_COUNT_PHRASES = {
  activeShipments: ['активный рейс', 'активных рейса', 'активных рейсов'],
  deals: ['сделка', 'сделки', 'сделок'],
  openDisputes: ['открытый спор', 'открытых спора', 'открытых споров'],
  documents: ['документ', 'документа', 'документов'],
  warnings: ['предупреждение', 'предупреждения', 'предупреждений'],
} as const satisfies Record<string, readonly [string, string, string]>;

export function countPhraseRu(n: number, phrase: keyof typeof RU_COUNT_PHRASES): string {
  const [one, few, many] = RU_COUNT_PHRASES[phrase];
  return countRu(n, one, few, many);
}
