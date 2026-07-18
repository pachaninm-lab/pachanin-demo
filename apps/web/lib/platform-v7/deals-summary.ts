/**
 * Живые агрегаты по списку сделок из /api/proxy/deals (getDealsCanonical).
 *
 * Список отдаёт по каждой сделке: status, totalKopecks (bigint как строка),
 * последний payment {status, amountKopecks} и shipments {status}. Считаем из
 * этого честные сводные числа для кокпитов кабинета — без мок-констант.
 */

type PaymentLike = { status?: string | null; amountKopecks?: string | number | null };
type ShipmentLike = { status?: string | null };
type DealLike = {
  status?: string | null;
  totalKopecks?: string | number | null;
  payments?: PaymentLike[] | null;
  shipments?: ShipmentLike[] | null;
};

const IN_TRANSIT_SHIPMENT = new Set(['DRIVER_ASSIGNED', 'LOADED', 'IN_TRANSIT', 'ARRIVED']);

function kopecks(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

export interface DealsSummary {
  count: number;
  active: number;
  closed: number;
  reservedKopecks: number;
  releasedKopecks: number;
  totalKopecks: number;
  inTransit: number;
}

export function summarizeDeals(input: unknown): DealsSummary {
  const deals = Array.isArray(input) ? (input as DealLike[]) : [];
  let reserved = 0;
  let released = 0;
  let total = 0;
  let inTransit = 0;
  let closed = 0;

  for (const deal of deals) {
    total += kopecks(deal?.totalKopecks);
    const payment = Array.isArray(deal?.payments) ? deal?.payments?.[0] : undefined;
    if (payment?.status === 'RESERVED') reserved += kopecks(payment.amountKopecks);
    if (payment?.status === 'RELEASED') released += kopecks(payment.amountKopecks);
    const shipment = Array.isArray(deal?.shipments) ? deal?.shipments?.[0] : undefined;
    if (shipment?.status && IN_TRANSIT_SHIPMENT.has(shipment.status)) inTransit += 1;
    if (deal?.status === 'CLOSED') closed += 1;
  }

  return {
    count: deals.length,
    active: deals.length - closed,
    closed,
    reservedKopecks: reserved,
    releasedKopecks: released,
    totalKopecks: total,
    inTransit,
  };
}

/** Компактный формат рублей из копеек для сводок кабинета. */
export function formatRubFromKopecks(value: number): string {
  const rub = value / 100;
  if (Math.abs(rub) >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(rub) >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub.toFixed(0)} ₽`;
}

type FocusDealLike = DealLike & {
  id?: string | null;
  culture?: string | null;
  lotId?: string | null;
};

export interface FocusDeal {
  id: string;
  status: string;
  culture: string | null;
  totalKopecks: number;
  reservedKopecks: number;
  releasedKopecks: number;
  stage: string;
  next: string;
}

/**
 * Человекочитаемый этап и следующий шаг по статусу сделки — та же машина, что
 * в deal-command.policy на сервере, но для лёгкой отрисовки в кабинете.
 */
export function dealStatusStage(status: string): { stage: string; next: string } {
  const map: Record<string, { stage: string; next: string }> = {
    DRAFT: { stage: 'Допуск', next: 'подтвердить допуск участников' },
    ADMISSION_APPROVED: { stage: 'Аукцион', next: 'открыть аукцион' },
    AUCTION_OPEN: { stage: 'Аукцион', next: 'подтвердить выигрышную ставку' },
    AUCTION_WON: { stage: 'Договор', next: 'подписать договор продавцом' },
    SELLER_SIGNED: { stage: 'Договор', next: 'подписать договор покупателем' },
    CONTRACT_SIGNED: { stage: 'Деньги', next: 'запросить резерв оплаты' },
    RESERVE_REQUESTED: { stage: 'Деньги', next: 'ожидается подтверждение резерва банком' },
    RESERVED: { stage: 'Логистика', next: 'назначить перевозку' },
    LOGISTICS_ASSIGNED: { stage: 'Логистика', next: 'подтвердить погрузку' },
    LOADED: { stage: 'Логистика', next: 'начать рейс' },
    IN_TRANSIT: { stage: 'Приёмка', next: 'подтвердить прибытие' },
    ARRIVED: { stage: 'Приёмка', next: 'зафиксировать вес' },
    WEIGHED: { stage: 'Доказательства', next: 'подтвердить независимый осмотр' },
    INSPECTION_CONFIRMED: { stage: 'Лаборатория', next: 'подписать лабораторный протокол' },
    QUALITY_ACCEPTED: { stage: 'Приёмка', next: 'принять поставку' },
    DELIVERY_ACCEPTED: { stage: 'Документы', next: 'закрыть комплект документов' },
    DOCUMENTS_COMPLETE: { stage: 'Расчёт', next: 'запросить выплату' },
    RELEASE_REQUESTED: { stage: 'Расчёт', next: 'ожидается подтверждение выплаты банком' },
    RELEASED: { stage: 'Закрытие', next: 'закрыть сделку' },
    CLOSED: { stage: 'Закрыто', next: 'сделка завершена' },
  };
  return map[status] ?? { stage: '—', next: 'нет данных' };
}

/**
 * «Фокусная» сделка для hero-кокпита: самая свежая незакрытая сделка (список
 * приходит отсортированным по updatedAt desc); если все закрыты — первая.
 */
export function focusDeal(input: unknown): FocusDeal | null {
  const deals = Array.isArray(input) ? (input as FocusDealLike[]) : [];
  if (deals.length === 0) return null;
  const pick = deals.find((d) => d?.status && d.status !== 'CLOSED') ?? deals[0];
  const status = String(pick?.status ?? '');
  const kop = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
    return Number.isFinite(n) ? n : 0;
  };
  const payment = Array.isArray(pick?.payments) ? pick?.payments?.[0] : undefined;
  const { stage, next } = dealStatusStage(status);
  return {
    id: String(pick?.id ?? ''),
    status,
    culture: pick?.culture ?? null,
    totalKopecks: kop(pick?.totalKopecks),
    reservedKopecks: payment?.status === 'RESERVED' ? kop(payment.amountKopecks) : 0,
    releasedKopecks: payment?.status === 'RELEASED' ? kop(payment.amountKopecks) : 0,
    stage,
    next,
  };
}

/** Строка живой сводки для LiveApiStatusBar/кокпита. */
export function dealsSummaryLine(summary: DealsSummary): string {
  return [
    `${summary.count} сделок`,
    `${summary.active} активных`,
    `резерв ${formatRubFromKopecks(summary.reservedKopecks)}`,
    `выплачено ${formatRubFromKopecks(summary.releasedKopecks)}`,
  ].join(' · ');
}
