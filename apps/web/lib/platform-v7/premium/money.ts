import type { MoneyState } from './types';

export function formatPremiumRub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ₽`;
}

export function formatPremiumRubCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} млн ₽`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`;
  return formatPremiumRub(value);
}

export function getMoneyBalanceDelta(money: MoneyState): number {
  return money.reservedRub - (money.readyToReleaseRub + money.heldRub + money.awaitingDocsRub + money.disputedRub + money.releasedRub);
}

export function isMoneyBalanced(money: MoneyState): boolean {
  return Math.abs(getMoneyBalanceDelta(money)) < 1;
}
