// Единый числовой источник «денег в работе» демонстрационного набора.
// Раньше сумма «15,89 млн ₽» жила магической строкой в нескольких экранах
// (оператор, реестр сделок) и разъезжалась с данными при любом их изменении.
// Здесь — резервы по сделкам демо-набора; всё счётное выводится отсюда.

export const DEMO_DEAL_RESERVED_RUB: Record<string, number> = {
  'DL-9106': 9_648_000,
  'DL-9102': 6_240_000,
};

/** Сумма резервов по РАЗЛИЧНЫМ сделкам набора (повторы одной сделки не задваиваются). */
export function demoMoneyAtRiskRub(dealIds: readonly string[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const id of dealIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    sum += DEMO_DEAL_RESERVED_RUB[id] ?? 0;
  }
  return sum;
}

/** Русский формат денег: запятая в дробной части («15,89 млн ₽»). */
export function formatMoneyRub(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2).replace('.', ',')} млн ₽`;
  if (rub >= 1_000) return `${Math.round(rub / 1_000)} тыс. ₽`;
  return `${rub} ₽`;
}
