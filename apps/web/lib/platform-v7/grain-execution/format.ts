import type { MaturityStatus, MoneyAmount, PriceBasis, UserRole } from './types';

export function money(value: number, currency: MoneyAmount['currency'] = 'RUB'): MoneyAmount {
  return { value, currency };
}

export function formatMoney(amount: MoneyAmount, options?: { readonly signed?: boolean }): string {
  const rounded = Math.round(amount.value);
  const sign = options?.signed && rounded > 0 ? '+' : '';
  const suffix = amount.currency === 'RUB' ? '₽' : amount.currency;
  return `${sign}${rounded.toLocaleString('ru-RU')} ${suffix}`;
}

export function formatMoneyPerTon(amount: MoneyAmount): string {
  return `${formatMoney(amount)}/т`;
}

export function formatTons(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} т`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export const maturityLabel: Record<MaturityStatus, string> = {
  sandbox: 'тестовый контур',
  manual: 'ручная проверка',
  'controlled-pilot': 'пилотный режим',
  live: 'боевое подключение',
};

export const basisLabel: Record<PriceBasis, string> = {
  EXW: 'EXW: самовывоз со склада продавца',
  FCA: 'FCA: отгрузка продавцом до перевозчика',
  CPT: 'CPT: доставка продавцом до точки покупателя',
  DAP: 'DAP: доставка до согласованной точки',
  FOB: 'FOB: передача на борту',
};

export const roleLabel: Record<UserRole, string> = {
  seller: 'продавец',
  buyer: 'покупатель',
  logistics: 'логист',
  driver: 'водитель',
  elevator: 'элеватор',
  lab: 'лаборатория',
  bank: 'банк',
  operator: 'оператор',
  investor: 'инвестор',
  admin: 'администратор',
};

export function readableStatus(status: string): string {
  return status
    .replaceAll('_', ' ')
    .replace('not ready', 'не готово')
    .replace('almost ready', 'почти готово')
    .replace('ready for sale', 'можно продавать')
    .replace('blocked', 'остановлено')
    .replace('draft', 'черновик')
    .replace('open', 'открыто')
    .replace('matching', 'подбор')
    .replace('accepted', 'принято')
    .replace('disputed', 'спорная часть')
    .replace('manual review', 'ручная проверка');
}
