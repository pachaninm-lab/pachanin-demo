import type { ReleaseGuardBlocker } from './release-guard';

export const MONEY_STOP_LABELS: Record<ReleaseGuardBlocker, string> = {
  NO_RESERVED_MONEY: 'нет подтверждённого резерва',
  NO_RELEASE_AMOUNT: 'нет суммы к выплате',
  HOLD_AMOUNT_ACTIVE: 'есть активное удержание',
  OPEN_DISPUTE: 'открыт спор',
  DOCUMENTS_NOT_READY: 'документы не закрыты',
  FGIS_NOT_READY: 'ФГИС/СДИЗ не подтверждены',
  TRANSPORT_NOT_READY: 'рейс или транспортные документы не закрыты',
  ACCEPTANCE_NOT_CONFIRMED: 'приёмка не подтверждена',
  QUALITY_NOT_APPROVED: 'качество не подтверждено',
  MANUAL_BLOCKER: 'есть ручная остановка',
  DEAL_NOT_READY: 'стадия сделки не готова к выплате',
};

export function moneyStopReasonText(reasons: readonly ReleaseGuardBlocker[]): string {
  return reasons.length ? reasons.map((reason) => MONEY_STOP_LABELS[reason]).join(', ') : '—';
}

export function primaryMoneyStopReason(reasons: readonly ReleaseGuardBlocker[]): string {
  return reasons[0] ? MONEY_STOP_LABELS[reasons[0]] : 'Нет причин остановки денег';
}
